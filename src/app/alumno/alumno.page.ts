import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlumnoInfoService } from '../services/alumno-info.service';
import { BarcodeScanner } from '@capacitor-community/barcode-scanner';
import { AsistenciaService } from '../services/asistencia.service';
import { AlertControllerService } from '../services/alert-controller.service';
import { AuthService } from '../services/auth.service';
import { SeguridadService } from '../services/seguridad.service';


@Component({
  selector: 'app-alumno',
  templateUrl: './alumno.page.html',
  styleUrls: ['./alumno.page.scss'],
})


export class AlumnoPage implements OnInit {

  userInfo: any = ''
  seccionesInscritas: any[] = [];
  alumnoInfo: any = null;
  idClase: string = '';
  isPresente: any = '';
  codigoSeguridad: number;
  codigoDB: number;
  alumnoPresente: boolean = false;
  resultadoScanner: any = '';

  TIPO_ERROR = 'Error al marcar asistencia.';
  TIPO_IS_PRESENTE = 'Usted ya está presente.'
  TIPO_EXITO = 'Exito al marcar asistencia.'
  MSJ_EXITO = 'Se ha registrado su asistencia de manera exitosa.';
  MSJ_SIN_USUARIO = 'No existe un usuario logueado, reinicie la aplicacion e intentelo nuevamente.';
  MSJ_SIN_ID_CLASE = 'Debes ingresar el código de la asignatura.';
  MSJ_IS_PRESENTE = 'Ya se ha registrado su asistencia.';
  MSJ_ERROR_MARCADO = 'Ocurrió un error al marcar asistencia.';
  MSJ_CODIGO_NO_VALIDO = 'El código ingresado no es válido.'
  MSJ_CODIGO_VACIO = 'Debe ingresar un código de seguridad.'

  constructor(
    private router: Router,
    private _auth: AuthService,
    private _alumno: AlumnoInfoService,
    private asistencia: AsistenciaService,
    private _seguridad: SeguridadService,
    private alertas: AlertControllerService
  ) { }

  ngOnInit() {
    this._auth.getCurrentUser().then(user => {
      if (user) {
        this.userInfo = user;
        console.log(this.userInfo);
        this.obtenerInfoDelAlumno(this.userInfo.id);
        if (this.alumnoPresente === false) {
          setInterval(() => {
            if (this.idClase !== '' && this.alumnoPresente === false) {
              this.obtenerCodigoSeguridad(this.idClase);
            }
          }, 2500);
        }
      } else {
        this.router.navigateByUrl('login');
      }
    });
  }

  obtenerInfoDelAlumno(id: string) {
    this._alumno.getAllAlumnoInfo(id)
      .subscribe(
        (data) => {
          this.alumnoInfo = data[0];
          this.seccionesInscritas = this.alumnoInfo.alumno_seccion
          console.log(this.alumnoInfo)
          console.log(this.seccionesInscritas)
        },
        (error) => {
          console.error('Error al obtener información del alumno:', error);
        }
      );
  }

  async marcarAsistencia() {
    if (!this.alumnoInfo) {
      this.mostrarError(this.TIPO_ERROR, this.MSJ_SIN_USUARIO);
      return;
    }
    if (this.idClase === '') {
      this.mostrarError(this.TIPO_ERROR, this.MSJ_SIN_ID_CLASE);
      return;
    }
    try {
      const respuesta = await this.asistencia.getEstadoAlumno(this.idClase, this.alumnoInfo.id).toPromise();
      if (respuesta[0].isPresente) {
        this.mostrarError(this.TIPO_IS_PRESENTE, this.MSJ_IS_PRESENTE);
        this.alumnoPresente = true;
        return;
      } else {
        const ahora = new Date();
        const fecha = ahora.getFullYear() + '-' + (ahora.getMonth() + 1) + '-' + ahora.getDate();
        const hora = ahora.getHours() + ':' + ahora.getMinutes() + ':' + ahora.getSeconds();
        await this.obtenerCodigoSeguridad(this.idClase)
        const data: any = {
          isPresente: true,
          hora: hora
        };
        if (this.codigoSeguridad === this.codigoDB) {
          const actualizacionExitosa = await this.asistencia.patchAsistenciaPorFechaYAlumno(this.idClase, fecha, this.alumnoInfo.id, data).toPromise();
          if (actualizacionExitosa) {
            console.log('Ya está presente en esta clase.');
          } else {
            console.log('Actualización exitosa:', actualizacionExitosa);
            this.mostrarError(this.TIPO_EXITO, this.MSJ_EXITO);
            this.alumnoPresente = true;
          }
        } else {
          if (this.codigoSeguridad === undefined) {
            this.mostrarError(this.TIPO_ERROR, this.MSJ_CODIGO_VACIO);
          } else {
            this.mostrarError(this.TIPO_ERROR, this.MSJ_CODIGO_NO_VALIDO);
          }
        }
      }
    } catch (error) {
      console.error('Error al marcar asistencia:', error);
      this.mostrarError(this.TIPO_ERROR, this.MSJ_ERROR_MARCADO);
    }
  }

  async escanearQR() {
    this.escanearQR();
    if (this.resultadoScanner !== '') {
      this.idClase = this.resultadoScanner.id_clase;
      this.codigoSeguridad = this.resultadoScanner.codigo_seguridad;
      this.marcarAsistencia();
    }
  }

  private mostrarError(tipoError: string, mensaje: string) {
    this.alertas.tipoError = tipoError;
    this.alertas.mensajeError = mensaje;
    this.alertas.showAlert();
  }

  private obtenerCodigoSeguridad(id_clase: string) {
    this._seguridad.getSeguridad(id_clase).subscribe(
      (respuesta) => {
        this.codigoDB = respuesta[0].codigo;
        console.log(this.codigoDB);
      },
      (error) => {
        console.error('Error al obtener información de seguridad:', error);
        console.log(error);
      }
    );
  }

  logout() {
    this.userInfo = undefined;
    this._auth.logout();
    this.router.navigateByUrl('login');
  }
  async verPermisos() {
    try {
      const status = await BarcodeScanner.checkPermission({ force: true });
      if (status.granted) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al obtener permisos:', error);
      return false;
    }
  }
  dejarEscanear() {
    BarcodeScanner.showBackground();
    BarcodeScanner.stopScan();
    const elemento: any = document.querySelector('body')
    elemento.classList.remove('scanner-active');
  }
  async escanear() {
    try {
      const permiso = await this.verPermisos();
      if (!permiso) {
        return;
      }
      await BarcodeScanner.hideBackground();
      const elemento: any = document.querySelector('body')
      elemento.classList.add('scanner-active');
      const result = await BarcodeScanner.startScan();
      console.log(result)
      if (result?.hasContent) {
        this.resultadoScanner = result.content;
        console.log(this.resultadoScanner)
        this.dejarEscanear();
        this.alertas.tipoError = 'Resultado del escaneo';
        this.alertas.mensajeError = this.resultadoScanner;
        this.alertas.showAlert();

      }
    } catch (error) {
      console.error('Error al escanear:', error);
      this.dejarEscanear();
    }
  }
  beforeDestroy() {
    BarcodeScanner.stopScan();
  }
}