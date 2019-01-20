'use strict';
/**
 * <strong> Punto de entrada de la aplicacion. </strong>
 * <ol>
 * 	<li> Inicializa electron, abriendo una ventana y añadiendo la vista correspondiente </li>
 *  <li> Mantiene una instancia única de la app abierta (con singleton) </li>
 *  <li> Instancia el log </li>
 *  <li> Mantiene la comunicación entre las vistas y el controlador</li>
 *  <li> Mantiene la lectura de eventos sobre los ficheros actualizados</li>
 *  <li> Realiza la comprobación de versión para las posibles actualizaciones</li>
 * </ol>
 * @class main
 * @module Ftp conexion
 */

/**
 * Electron, para soporte visual.
 * @property electron
 * @type Object

 */
const electron = require('electron');
/**
 * Modulo para controlar la vida de la aplicacion
 * Esta constante hace toda la magia con electron.
 * @property app
 * @type Object

 */
const app = electron.app;
/**
 * Funcionalidad de electron para crear una ventana nativa.<br/> 
 * Las ventanas de electron estan basadas en el navegador chromium
 * @property BrowserWindow
 * @type Object

 */
const BrowserWindow = electron.BrowserWindow;
/**
 * Funcionalidad de electron para permitir abrir ficheros.<br/> 
 * Automagicamente elige el programa por defecto del ordenador y lo utiliza para abrir el fichero seleccionado
 * @property shell
 * @type Object

 */
const shell = electron.shell;
/**
 * Modulo la lectura de paths de forma segura e independiente del sistema operativo.<br/> 
 * Ofrece ampliacion de funciones sobre el modulo path
 * @property upath
 * @type Object
 */
const upath = require('upath');
/**
 * Modulo la lectura de paths de forma segura e independiente del sistema operativo
 * @property path
 * @type Object

 */
const path = require('path');
/**
 * Modulo para la comunicación entre clases.<br/> 
 * Este modulo es el que hace toda la magia de comunicación con envío y recepción de parametros
 * @property Router
 * @type Object

 */
const Router = require('electron-router');
var router = Router('index');
/**
 * Modulo para el tratamiento de directorios de forma recursiva
 * @property enfsmkdirp
 * @type Object
 */
var enfsmkdirp = require("enfsmkdirp");

/**
 * Modulo para el tratamiento de ficheros con ampliacion sobre fs nativo de Node
 * @property fsExtra
 * @type Object
 */
const fsExtra = require('fs-extra');
/**
 * Modulo nativo de node para el tratamiento de ficheros
 * @property fsExtra
 * @type Object
 */
var fs = require('fs');
/**
 * Modulo para el tratamiento de ficheros de log
 * @property log
 * @type Object
 */
var log = require('electron-log');
/**
 * Modulo de utilidades para node
 * @property util
 * @type Object
 */
const util = require('util');
/**
 * Modulo para monitorizar los ficheros abiertos en el ordenador
 * @property chokidar
 * @type Object
 */
const chokidar = require('chokidar');
/**
 * Modulo para peticiones HTTP mediante Ajax
 * @property XMLHttpRequest
 * @type Object
 */
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
/**
 * Modulo para formatear las fechas
 * @property dateFormat
 * @type Object

 */
const dateFormat = require('dateformat');
dateFormat.masks.hammerTime = "dd-mm-yyyy, HH_MM_ss";
/**
 * Modulo de electron para almacenar pequeñas variables de configuracion
 * @property ElectronSettings
 * @type Object

 */
var ElectronSettings = require('electron-settings');
var settings = new ElectronSettings();
/**
 * Modulo encriptar con CTR. Algoritmo: aes-256-ctr
 * @property crypto
 * @type Object

 */
const crypto = require('crypto'),
	algorithm = 'aes-256-ctr',
	password = 'ftp2019';
/**
 * Controlador para la comunicación con la librería FTP
 * @property controlador
 * @type Object

 */
var controlador = require("./controlador/controlador.js");
controlador = new controlador();
/**
 * Gestion de los logs una vez cerrada la aplicacion
 * @property envioLog
 * @type Object

 */
var envioLog = require("./envioLog.js");

/**
 * Modulo para la ejecución de funciones sincrona.<br/>
 * Se esta usando para recorrer ficheros y su posterior tratamiento de forma secuencial
 * @property async
 * @type Object
 */
const async = require('async');

/**
 * Variable con el directorio en local donde se van a colocar todos los ficheros
 * que se vayan descargando del ftp
 * @property dirFicherosLocal
 * @type String
 */
var dirFicherosLocal;
/**
 * Variable que se utiliza como control de errores recibidos del controlador o vista.<br/> 
 * Se utilizó para enviar el log con los errores en caso de haberlos.<br/> Se puede volver a 
 * utilizar si se quieren recoger los log solo con errores en lugar de todos
 * @property hayErrores
 * @type Boolean

 */
var hayErrores = false;
/**
 * Variable que recoge el nombre del log para futuros tratamientos durante la ejecución de la aplicación
 * @property logActual
 * @type String

 */
var logActual;
/**
 * Variable que mantiene la referencia del usuario y contraseña de login
 * @property modeloLogin
 * @type modeloLogin

 */
var modeloLogin = null;
/**
 * Referencia global del objeto ventana principal, muestra las vistas principales de trabajo del usuario.<br/> 
 * Si no fuera global la ventana se cerraría cuando el garbage collector de JS apareciera
 * @property mainWindow
 * @type Object

 */
var mainWindow = null;
/**
 * Referencia global del objeto ventana de cambios, muestra la vista con el log de cambios cuando el usuario
 * abre por primera vez la aplicacion o cuando la actualiza.<br/> 
 * Si no fuera global la ventana se cerraría cuando el garbage collector de JS apareciera
 * @property cambiosWindow
 * @type Object

 */
var cambiosWindow = null;
/**
 * Referencia del objeto watcher sobre el que instanciar el visor de ficheros
 * @property watcher
 * @type Object

 */
var watcher = null;
var cierraApp = false;
const rutaDefecto = require("./datosServer.json")["ruta"];
//Version actual
const versionActual = require("./package.json")["version"];

/**
 * Referencia a la app existente.<br/> Si se intenta correr una segunda instancia de la app
 * lo que se hace es mostrar la app desminimizando o haciendo focus
 * @property shouldQuit
 * @type Object
 */
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	app.quit()
}
else {
	app.on('second-instance', (event, commandLine, workingDirectory) => {
		// Someone tried to run a second instance, we should focus our window.
		if (myWindow) {
			if (myWindow.isMinimized()) myWindow.restore()
			myWindow.focus()
		}
	})
}
/* const shouldQuit = app.makeSingleInstance((commandLine, workingDirectory) => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) 
			mainWindow.restore();
		mainWindow.focus()
	}
})

if (shouldQuit) {
	app.quit()
} */

/**
 * Como el document ready de jquery para electron.<br/> 
 * Una vez que se haya ejecutado este evento es cuando se puede empezar a trabajar con las ventanas de la aplicacion
 * @event app.on(ready
 * @param {Function} inicio
 */
app.on('ready', inicio);

/**
 * <ul>
 * <li>Contiene la instanciación de la ventana principal donde se carga la vista index.html</li>
 * <li>Instancia la ventana de cambios en caso de que la versión almacenada en settings y la versión de la app no coincidan</li>
 * <li>Crea el directorio en local donde se irán almacenando los ficheros descargados</li>
 * <li>Se instancia la configuración del log</li>
 * <li>Se instancian el registro sobre los eventos de cerrar ventana</li>
 * </ul>
 * @method inicio
 * @return función de carga de evento
 */
function inicio() {
	//Si no es la primera vez que entra pero ha actualizado -> mostrar log de cambios
	if (settings.get('version') === null || settings.get('version') !== versionActual) {
		cambiosWindow = new BrowserWindow({
			width: 800,
			height: 400,
			center: true,
			show: true
		});
		cambiosWindow.loadURL('file://' + upath.joinSafe(__dirname, '/vista/html/cambios.html'));
	}
	settings.set('version', versionActual)

	//Con esto se unen los directorios de forma independiente al SO
	dirFicherosLocal = upath.joinSafe(app.getPath('appData'), 'tmp');
	enfsmkdirp.mkdirp(dirFicherosLocal, function (err) {
		if (err) {
			log.error("error creando el directorio temporal", err)
		}
	});

	configuraLog();

	//Pantalla principal
	mainWindow = new BrowserWindow({
		width: 900,
		minWidth: 900,
		height: 600,
		minHeight: 600,
		center: true,
		show: true
	});
	//Cargo el index html en el principal
	mainWindow.loadURL('file://' + upath.joinSafe(__dirname, '/vista/html/index.html'));

	//Una vez que ha cargado la pantalla principal -> comenzar con la logica
	mainWindow.webContents.on('did-finish-load', eventosLogin);

	eventosCerrarVentana();

}
/**
 * Contiene los registros sobre los eventos de antes de cerrar ventana y de despues de cerrar ventana.<br/> 
 * Además registra el evento sobre router de petición de cerrar ventana
 * @method eventosCerrarVentana
 * @return función de registro de eventos
 */
function eventosCerrarVentana() {

	/**
	 * Emitido cuando la ventana pricipal es cerrada.</br> 
	 * Desregistra los eventos sobre la ventana y nulifica la referencia
	 * @event mainWindow.on(closed
	 * @param {Function} anonima
	 */
	mainWindow.on('closed', function () {
		mainWindow.removeAllListeners();
		mainWindow = null;
	});
	/**
	 * Emitido antes de que la ventana sea cerrada.</br> 
	 * Comprueba si la variable cierraApp es true, si es false no se cierra la ventana. Además:
	 * <ol>
	 * <li>Antes de cerrar la ventana hace la llamada a la clase que envia el log para su guardado.</li>
	 * <li>Llama a la función antesCerrarAplicacion() que cierra las cosas que deben ser cerradas antes de cerrar la ventana</li>
	 * </ol> 
	 * @event mainWindow.on(close
	 * @param {Function} anonima parametro e: evento lanzado
	 */
	mainWindow.on('close', function (e) {
		if (!cierraApp) {
			e.preventDefault();
			antesCerrarAplicacion();
		}
	});
	/**
	 * Recibe el evento cerrar FTP. Si se ha emitido porque hay un error grave entonces 
	 * manda un aviso a la vista y cierra la aplicacion
	 * @event router.on(cerrarFTP
	 * @param {Function} anonima parametro origen: para comprobar el origen de la llamada a este evento
	 */
	router.on("cerrarFTP", function (origen) {
		if (origen == "errorGrave") {
			router.send("errorGrave");
		}
		else if (origen == "fuerzaCierre") {
			cierraApp = true;
		}
		router.removeListener("errorIntentarOtraVez", function () { });
		if (mainWindow != null) {
			mainWindow.close();
		}
	});
}

/**
 * Envia los logs y los elimina (en local)
 * @method enviaLog
 * @return null
 */
function enviaLogs(callbackFin) {
	var dirLog = upath.joinSafe(app.getPath('appData'), 'logFtp');
	var logs = fs.readdirSync(dirLog);

	var i = -1;
	async.whilst(
		function () { i++; return i < logs.length },
		function (callback) {
			var pathCompleto = upath.joinSafe(dirLog, logs[i]);
			//Se almacena el fichero en el ftp
			if (fs.existsSync(pathCompleto)) {
				envioLog(pathCompleto, (settings.get("usuario") == null ? " " : settings.get("usuario")), function (respuesta) {
					if (respuesta === 'OK') {
						fsExtra.removeSync(pathCompleto);
						callback(null, "fin");
					}
					else {
						log.error("log no subido", logs[i])
						callback("noSubido", null)
					}
				});
			}
			else {
				callback("noExiste", null)
			}
			// if any of the saves produced an error, err would equal that error
		}, function (err) {
			// if any of the file processing produced an error, err would equal that error
			if (err) {
				log.error('error ', err);
			}
			else
				log.info('ok, todos los logs subidos');
			callbackFin("FIN")
		});
}

/**
 * Registra los eventos necesarios para el proceso de login:
 * <ol>
 * 	<li> Comprueba si la ventana de cambios ha sido cargada para darle el focus </li>
 * 	<li> Revisa si hay alguna actualización y se registra la comprobación de versión cada 6 horas</li>
 * 	<li> Envia los datos de login almacenados en settings a la vista de login </li>
 * 	<li> Registra los eventos sobre el router para hacer login y cargar los ficheros </li>
 * </ol>
 * @method eventosLogin
 * @return función de registro de eventos
 */
function eventosLogin() {
	//Despues de abrir la principal -> abrir la de cambios
	if (cambiosWindow !== null) {
		cambiosWindow.focus();
	}
	//Revisar la version en el servidor al iniciar y cada 6 horas por si no se cierra el programa	
	revisaVersion();
	//Cada 6 horas -> comprobar la version
	setInterval(revisaVersion, 10000 * 21600);

	router.send("datosLogin", settings.get("usuario"), settings.get("password"),
	 settings.get("url"), settings.get("puerto"));

	/**
	 * Recibe el usuario y contraseña de login para realizar la conexión al FTP
	 * @event router.on(login
	 * @param {Function} anonima parametro resp: datos introducidos para el logado
	 */
	router.on("login", function (resp) {
		//Se guardan los datos de login en los settings		
		if (resp.recordar) {
			settings.set("usuario", resp.usuario)
			var password = encrypt(resp.password);
			settings.set("password", password)
			settings.set("url", resp.url)
			settings.set("puerto", resp.puerto)
		}

		controlador.compruebaLogin(resp.usuario, resp.password, resp.url, resp.puerto, loginFTP);

	});
	/**Primera carga de la lista de ficheros
	 * @event router.on(cargaVistaFicheros
	 * @param {Function} cargaVistaFicheros
	 */
	router.on("cargaVistaFicheros", cargaVistaFicheros);
}
/**
 * Comprueba los datos recogidos del proceso de logado:
 * <ul> 
 * 	<li> Si hay error es que los datos no son correctos, avisar en la pantalla de login</li>
 * 	<li> Si no hay error se comprueba si existe el fichero lock en la raiz:
 * 		<ul> 
 * 			<li> Si existe el fichero se manda el aviso a la vista para ver si quiere seguir logandose</li>
 * 			<li> Si no existe el fichero se carga la vista de listaFicheros.html</li>
 * 		</ul>
 * </li>
 * </ul>
 * @method loginFTP
 * @param {String} error en caso de haber algun error
 * @param {Object} data los datos de login si el logado se ha realizado correctamente 
 * @return función para comprobar el correcto logado
 */
function loginFTP(error, data) {
	if (error === null) {
		modeloLogin = data.modelo;
		log.info("login realizado", modeloLogin.usuario)
		//Conexion correcta -> comprobar .lock en la cuenta

		var lockFile = upath.joinSafe(rutaDefecto, modeloLogin.usuario) + ".lock";
		//Comprobar si existe fichero
		controlador.ficheroBloqueado(lockFile, function (error, existeFichero) {
			if (error) {
				log.error("error al buscar el fichero lock", error)
			}
			if (existeFichero) {
				//ficheroBloqueado
				router.send("ficheroBloqueado");
			}
			//Crear fichero .lock y cargar la lista de ficheros
			else {
				controlador.subeFicheroLock(lockFile, function (error, ficheroSubido) {
					if (ficheroSubido) {
						log.info("fichero lock subido");
						cargaVistaFicheros();
					}
					else {
						log.error("fichero lock no subido", error);
						hayErrores = true;
						router.send("errorIntentarOtraVez");
					}
				});
			}
		});
	}
	else {
		router.send("errorLogin");
	}
}

/**
 * Recoge la lista de ficheros de la carpeta raiz, los envia a la vista y registra los eventos
 * de router que se pueden recibir de la vista
 * @method cargaVistaFicheros
 * @return función cargar la vista de listaFicheros.html
 */
function cargaVistaFicheros() {
	controlador.listaFicheros(rutaDefecto, function (error, ficheros) {
		if (error) {
			log.error("error al extraer los ficheros", error)
		}
		//Importante quitar la funcion asociada al evento ya que se duplican al cargar mas de una vista
		mainWindow.webContents.removeListener('did-finish-load', eventosLogin)
		mainWindow.loadURL('file://' + upath.joinSafe(__dirname, '/vista/html/listaFicheros.html'));
		mainWindow.webContents.on('did-finish-load', function () {
			router.send("listaFicheros", { "ficheros": ficheros, "ruta": rutaDefecto });
			registraEventosFichero();
		});
	});
}

/**
 * Eventos que se registran sobre los ficheros:
 * <ul>
 * 	<li> Eliminar carpeta</li>
 * 	<li> Eliminar fichero</li>
 * 	<li> Mover cualquiero fichero de carpeta</li>
 * 	<li> Abrir carpeta</li>
 * 	<li> Guardar una lista de ficheros</li>
 * 	<li> Crear una nueva carpeta</li>
 * 	<li> Abrir un fichero y hacer seguimiento de los cambios</li>
 * 	<li> Subir un fichero y despues hacer el seguimiento</li>
 * </ul>
 * @method registraEventosFichero
 * @return función que registra eventos a realizar sobre los ficheros
 */
function registraEventosFichero() {

	/**
	 * Recibe la ruta de la carpeta a eliminar y la ruta en la que esta posicionado.<br/> 
	 * Se eliminan de forma recursiva los ficheros y directorios y se carga la lista de ficheros para refrescar la vista
	 * listaFicheros.html
	 * @event router.on(eliminaCarpeta
	 * @param {Function} anonima parametro rutas: ruta de la carpeta a eliminar y ruta en la que esta posicionado
	 */
	router.on("eliminaCarpeta", function (rutas) {
		controlador.eliminaCarpeta(rutas.rutaCarpeta, function (eliminado) {
			if (eliminado) {
				log.info("Eliminada carpeta ", rutas.rutaCarpeta)
			}
			else {
				log.error("Error eliminando carpeta ", rutas.rutaCarpeta)
			}
			router.send("abrirCarpeta", { "ruta": rutas.rutaActual });
		});

	});
	/**
	 * Recibe la ruta del fichero a eliminar y la ruta en la que esta posicionado.<br/> 
	 * Se elimina el fichero y se carga la lista de ficheros para refrescar la vista
	 * listaFicheros.html
	 * @event router.on(eliminaFichero
	 * @param {Function} anonima parametro rutas: ruta del fichero a eliminar y ruta en la que esta posicionado
	 */
	router.on("eliminaFichero", function (rutas) {
		controlador.eliminaFichero(rutas.rutaCarpeta, function (eliminado) {
			if (eliminado) {
				log.info("Fichero eliminado ", rutas.rutaCarpeta)
			}
			else {
				log.error("Error eliminando fichero ", rutas.rutaCarpeta)
			}
			router.send("abrirCarpeta", { "ruta": rutas.rutaActual });
		});
	});

	/**
	 * Recibe la ruta del archivo a cambiar y la ruta en la que esta posicionado.<br/> 
	 * Se cambia el archivo y se carga la lista de ficheros para refrescar la vista
	 * listaFicheros.html
	 * @event router.on(cambiaArchivoCarpeta
	 * @param {Function} anonima parametro rutas: ruta del archivo a cambiar y ruta en la que esta posicionado
	 */
	router.on("cambiaArchivoCarpeta", function (rutas) {
		controlador.cambiaCarpetaFichero(rutas.from, rutas.to, function (error, cambiado) {
			if (cambiado) {
				log.info("fichero desde ", rutas.from, "cambiado a ", rutas.to)
				router.send("abrirCarpeta", { "ruta": rutas.rutaDestino });
			}
			else if (error === "ficheroExisteEnDirectorio") {
				log.error("Error cambiando fichero desde ", rutas.from, " a ", rutas.to)
				router.send("ficheroExisteEnDirectorio");
			}
		});
	});

	/**
	 * Refrescar la vista listaFicheros.html con los ficheros de la ruta seleccionada
	 * @event router.on(abrirCarpeta
	 * @param {Function} anonima parametro fichero: ruta sobre la que cargar los ficheros de la vista
	 */
	router.on("abrirCarpeta", function (fichero) {
		controlador.listaFicheros(fichero.ruta, function (error, ficheros) {
			if (error) {
				log.error("error al extraer los ficheros", error)
			}
			router.send("listaFicheros", { "ficheros": ficheros, "ruta": fichero.ruta });
		});
	});

	/**
	 * Sube la lista de ficheros seleccionados sobre la ruta recibida
	 * @event router.on(subeFicheros
	 * @param {Function} anonima parametro datos: ficheros y ruta
	 */
	router.on("subeFicheros", function (datos) {
		var ficheros = datos.modelos;
		var pathFichero = datos.rutaActual;
		controlador.subeFicheros(ficheros, pathFichero, function (ficheroSubido) {
			if (ficheroSubido) {
				log.info("ficheros subidos", pathFichero);
				router.send("subidoCorrectamente", true);
			}
			else {
				log.error("ficheros no subidos", pathFichero);
				hayErrores = true;
				router.send("errorIntentarOtraVez");
			}
		});

	});
	/**
	 * Añade un directorio en la ruta seleccionada.
	 * @event router.on(nuevaCarpeta
	 * @param {Function} anonima parametro dato: ruta y nombre
	 */
	router.on("nuevaCarpeta", function (dato) {
		var rutaCompleta = upath.joinSafe(dato.ruta, dato.nombre);
		controlador.nuevaCarpeta(rutaCompleta, function (error, creada) {
			if (creada) {
				log.info("carpeta creada", rutaCompleta);
				router.send("subidoCorrectamente", true);
			}
			else if (error === "carpetaExisteEnDirectorio") {
				log.error("carpeta no creada porque ya existe", rutaCompleta);
				hayErrores = true;
				router.send("carpetaExisteEnDirectorio");
			}
			else {
				log.error("Carpeta no creada", error);
				hayErrores = true;
				router.send("errorIntentarOtraVez");
			}
		});
	});

	/**
	 * Abre un fichero descargandolo del ftp y colocandolo en la ruta temporal del equipo local:
	 * <ol>
	 * 	<li> Se crea la carpeta donde esta el fichero en caso de no existir</li>
	 * 	<li> Se comprueba si ya existe el fichero en el directorio:
	 * 		<ul>
	 * 			<li>Si no existe se descarga </li>
	 * 			<li>Si existe se comprueba si el fichero en local tiene cambios mas actuales que el fichero en FTP:
	 * 				<ul>
	 * 					<li>Si la fecha de modificacion en local es posterior al ftp o 
	 * 						el tamaño en local es superior al del ftp, se lanza un aviso de fichero desactualizado</li>
	 * 					<li>Si no, el fichero del ftp es posterior, solo descargar</li>
	 * 				</ul>
	 *  		</li>
	 * 		</ul>
	 *  </li>
	 * </ol>
	 * @event router.on(abrirFichero
	 * @param {Function} anonima parametro fichero: fichero completo a descargar
	 */
	router.on("abrirFichero", function (fichero) {

		var directorioTmp = upath.joinSafe(dirFicherosLocal, fichero.ruta);

		enfsmkdirp.mkdirp(directorioTmp, function (err) {
			if (!err) {
				var rutaOrigen = upath.joinSafe(fichero.ruta, fichero.nombre);
				directorioTmp = upath.joinSafe(directorioTmp, fichero.nombre);
				//Comprobar el fichero a descargar antes de descargarlo, para comprobar si hay cambios en local
				if (fs.existsSync(directorioTmp)) {
					controlador.fechaFichero(rutaOrigen, function (error, datos) {
						if (!error) {
							//Se comprueba la fecha y el tamanio
							var sizeFTP = datos.size;
							var mfechaFTP = new Date(datos.fecha)
							fichero.fecha = mfechaFTP;
							mfechaFTP.setSeconds(0);
							var stats = fs.statSync(directorioTmp);
							var mtimeLocal = new Date(util.inspect(stats.mtime));
							mtimeLocal.setSeconds(0);
							/*Si la fecha en local es > que la fecha en FTP ||
							 * el tamanio en local es > que en el FTP --> lanzar el aviso*/
							if (mtimeLocal.toUTCString() > mfechaFTP.toUTCString() || stats.size > sizeFTP) {
								log.info("fichero desactualizado, tamanio ftp", sizeFTP, "tamanio local ", stats.size, "fecha ftp ", mfechaFTP, "fecha local ", mtimeLocal)
								router.send("ficheroDesactualizado", { "fichero": fichero, "fechaLocal": util.inspect(stats.mtime) });
							}
							//Si no -> descargar
							else {
								descargarFichero(rutaOrigen, directorioTmp);
							}
						}
						else {
							log.error("Fichero no abierto", error);
							hayErrores = true;
							router.send("errorIntentarOtraVez");
						}
					});

				}
				//Si no existe -> descargar
				else {
					descargarFichero(rutaOrigen, directorioTmp);
				}
			}
			else {
				log.error("error al crear el directorio", err);
				hayErrores = true;
				router.send("errorIntentarOtraVez");
			}
		});
	});

	/**
	 * Para el caso de confirmar la descarga de un fichero desactualizado en local 
	 * @event router.on(descargaFichero
	 * @param {Function} anonima parametro fichero
	 */
	router.on("descargaFichero", function (fichero) {
		var directorioTmp = upath.joinSafe(dirFicherosLocal, fichero.ruta);
		var rutaOrigen = upath.joinSafe(fichero.ruta, fichero.nombre);
		directorioTmp = upath.joinSafe(directorioTmp, fichero.nombre);
		descargarFichero(rutaOrigen, directorioTmp);
	});

	/**
	 * Para el caso de subir primero el fichero al ftp y despues abrirlo en local.<br/> 
	 * Se sube el fichero al ftp para actualizarlo y se abre en local para trabajar con el
	 * @event router.on(subeFicheroYDescarga
	 * @param {Function} anonima parametro datos: fichero y ruta actual
	 */
	router.on("subeFicheroYDescarga", function (datos) {
		var fichero = datos.modelo;
		var pathFichero = datos.rutaActual;
		var rutaDestino = upath.joinSafe(pathFichero, fichero.nombre);
		var rutaOrigen = upath.joinSafe(dirFicherosLocal, upath.normalize(fichero.ruta), fichero.nombre);
		controlador.subeFichero(rutaOrigen, rutaDestino, function (ficheroSubido) {
			if (ficheroSubido) {
				log.info("fichero subido", fichero.nombre);
				router.send("subidoCorrectamente", false);
				watchFile(rutaOrigen);
			}
			else {
				log.error("fichero no subido", fichero.nombre);
				hayErrores = true;
				router.send("errorIntentarOtraVez");
			}
		});

	});
}
/**
 * Descarga el fichero
 * <ul>
 * 	<li> Si todo ok, se abre el fichero y se hace el seguimiento de los cambios</li>
 * 	<li> Si hay un error tipo EBUSY es que el fichero esta abierto en local, mandar el aviso</li>
 * 	<li> Si hay otro tipo de error se manda el aviso para que trate de volver a descargarlo</li>
 * </ul>
 * @method descargarFichero
 * @param {String} rutaOrigen la ruta del ftp desde donde se quiere descargar
 * @param {String} directorioTmp ruta en local donde se descargara el fichero
 * @return función que descarga el fichero, lo coloca en la ruta temporal y hace un seguimiento sobre los cambios
 */
function descargarFichero(rutaOrigen, directorioTmp) {
	controlador.descargaFichero(rutaOrigen, directorioTmp, function (error, descargado) {
		if (descargado) {
			log.info("fichero descargado", rutaOrigen);
			watchFile(directorioTmp);
		}
		else if (error.toString().includes("EBUSY")) {
			log.info("Fichero abierto en local", rutaOrigen)
			router.send("errorEBUSY");
		}
		else {
			log.error("fichero no descargado", rutaOrigen, error);
			hayErrores = true;
			router.send("errorIntentarOtraVez");
		}
	})
}
/**
 * Abre el fichero en local con el programa predeterminado por el sistema operativo
 * <ul>
 * 	<li>Si aun no hay ningun fichero en seguimiento, comenzar el seguimiento con este fichero </li>
 * 	<li>Si hay ficheros en seguimiento, se comprueba si este fichero ya lo está. <br/> 
 * 		Si el fichero no está en seguimiento, ponerlo en seguimiento
 *  </li>
 *  <li>Si no hay ficheros en seguimiento, añadir este fichero al seguimiento </li>
 * </ul>
 * @method watchFile
 * @param {String} directorio ruta en local donde esta el fichero del que se quiere hacer seguimiento
 * @return null
 */
function watchFile(directorio) {
	if (shell.openItem(directorio)) {
		//Si no hay watcher comenzar 
		if (!watcher) {
			watcherDir(directorio)
		}
		//Si hay watcher comprobar que no esta asociado al fichero a observar
		else {
			//Recoger el directorio y normalizarlo
			var dirWatched = path.normalize(path.parse(directorio).dir);
			//Se recoge el nombre del fichero
			var nombreFichero = path.parse(directorio).base;
			//Se recogen los watchers del directorio en caso de haberlos
			var watchers = watcher.getWatched()[dirWatched];
			if (watchers) {
				var existe = false;
				//Se comprueba si el fichero a descargar ya esta siendo watcheado
				for (var i = 0; i < watchers.length; i++) {
					if (watchers[i] === nombreFichero) {
						existe = true;
					}
				}
				//Poner watcher solo si no lo tiene ya
				if (!existe)
					watcher.add(directorio)
			}
			//Si no hay watchers -> poner el nuevo watcher
			else {
				watcher.add(directorio)
			}
		}
	}
}
/**
 * Hace el seguimiento del fichero abierto en local con la siguiente configuracion: 
 * <ul>
 * 	<li>Ignorar los directorios, solo seguimiento de ficheros </li>
 *  <li>Escuchar eventos cada dos segundos y cuando el fichero ha cambiado de tamaño por lo menos en 1000 bits</li>
 *  <li>preventPathTransformation, para evitar errores al leer ficheros con parentesis</li>
 *  <li>Escuchar solo los eventos change</li>
 *  <li>Cuando haya un cambio sobre un fichero, subir el fichero al ftp</li>
 * </ul>
 * @method watcherDir
 * @param {String} directorio ruta en local donde esta el fichero del que se quiere hacer seguimiento
 * @return null
 */
function watcherDir(directorio) {
	watcher = chokidar.watch(directorio, {
		ignored: /[\/\\]\./,
		awaitWriteFinish: {
			stabilityThreshold: 2000,
			pollInterval: 1000
		},
		followSymlinks: false,
		usePolling: true,
		preventPathTransformation: true,
		interval: 100
	}).on('change', (path) => {
		/*Si al descargar el fichero ya existia, se recoge un evento change.
	Solo queremos guardar el fichero cuando haya un cambio de verdad*/

		//Path es la ruta de origen en el ordenador local
		//Obtengo la de destino quitando la parte de temporal
		var rutaDestino = upath.normalize(path).replace(dirFicherosLocal, "");
		controlador.subeFichero(path, rutaDestino, function (ficheroSubido) {
			if (ficheroSubido) {
				log.info("fichero subido en watcher", path);
				router.send("subidoCorrectamente", false);
			}
			else {
				log.error("fichero no subido en watchwer", path);
				hayErrores = true;
				router.send("errorIntentarOtraVez");
			}
		});
	}).on('error', function (error) { log.error('Error happened', error); });
}
/**
 * Crea el fichero de log en el directorio temporal de logs 
 * <ul>
 * 	<li>Como nombre de fichero: log, el usuario y la fecha actual </li>
 *  <li>Escribe en el log la versión que se esta usando y el sistema operativo</li>
 * </ul>
 * @method configuraLog
 * @return null
 */
function configuraLog() {
	log.transports.file.level = 'warning';
	log.transports.file.format = '{d}-{m} {h}:{i}:{s}:{ms} {text}';

	// Set maximum log size in bytes. When it exceeds, old log will be saved 
	// as log.old.log file 
	log.transports.file.maxSize = 5 * 1024 * 1024;
	//Directorio para logs
	var dirLog = upath.joinSafe(app.getPath('appData'), 'logFtp');
	enfsmkdirp.mkdirp(dirLog, function (err) {
		logActual = upath.joinSafe(dirLog, "log-" + (settings.get("usuario") == null ? "" : settings.get("usuario")) + '(' + dateFormat(new Date(), "hammerTime") + ").txt");
		// Write to this file, must be set before first logging 
		log.transports.file.file = logActual;

		// fsExtra.createWriteStream options, must be set before first logging 
		log.transports.file.streamConfig = { flags: 'w' };
		log.info("Version", versionActual, "SO", process.platform);
	});
}

/**
 * Cifra el texto con el algoritmo y la contraseña definidos
 * @method encrypt
 * @param {String} text trxto que se quiere cifrar
 * @return texto cifrado
 */
function encrypt(text) {
	var cipher = crypto.createCipher(algorithm, password)
	var crypted = cipher.update(text, 'utf8', 'hex')
	crypted += cipher.final('hex');
	return crypted;
}

/**
 * Comprueba la versión publicada en el host con la versión actual. Consta de 3 dígitos:<br/>
 * Respecto a la versión actual:
 * <ul> 
 * 	<li>Si el primer digito es menor o el primer digito es igual y el segundo es menor -> actualizacion obligatoria</li>
 * 	<li>Si los dos primeros son iguales y el ultimo es menor -> actualizacion opcional</li>
 * 	<li>Si no, no hay diferencias entre las versiones</li>
 * </ul>
 * @method revisaVersion
 * @return null
 */
function revisaVersion() {
	//TODO: I need a server for that
	/* var xhr = new XMLHttpRequest();
	var ultimaVersionServer;
	xhr.open('POST', '/ftpConexionVersion.txt', true);
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	xhr.onload = function () {
		if (xhr.status === 200) {
			ultimaVersionServer = xhr.responseText;
			//Si son distintas, comprobar version
			if (versionActual !== ultimaVersionServer) {
				var versionActualSplit = versionActual.split(".");
				var ultimaVersion = ultimaVersionServer.split(".");
				//Si el primer digito es menor o el primer digito es igual y el segundo es menor -> actualizacion obligatoria
				if (versionActualSplit[0] < ultimaVersion[0] ||
					(versionActualSplit[0] === ultimaVersion[0] && versionActualSplit[1] < ultimaVersion[1])) {
					router.send("actualizacionObligatoria", ultimaVersionServer);
				}
				//Si los dos primeros son iguales y el ultimo es menor -> actualizacion opcional
				else if (versionActualSplit[0] === ultimaVersion[0] && versionActualSplit[1] === ultimaVersion[1] &&
					parseInt(versionActualSplit[2]) < parseInt(ultimaVersion[2])) {
					router.on("descargaActualizacion", descargarActualizacion);
					router.send("actualizacionOpcional", ultimaVersionServer);
				}
				else
					router.send("sinActualizacion");
			}
			else
				router.send("sinActualizacion");
		}
		else if (xhr.status !== 200) {
			log.error('Request failed.  Returned status of ', xhr.status);
			hayErrores = true;
			router.send("sinActualizacion");
		}
	};
	xhr.send(); */
}

/**
 * Abre una ventana en el navegador con la ruta donde se aloja el fichero con la actualizacion
 * @method descargarActualizacion
 * @return null
 */
function descargarActualizacion() {
	//TODO: I need a server for that
	//shell.openExternal("");
}
/**
 * Pasos a dar antes de cerrar la aplicación:
 * <ul>
 * 	<li>Si hay ficheros en seguimiento, cerrarlos</li>
 * 	<li>Si hay un fichero lock, eliminarlo</li>
 *  <li>Se pone la variable cerrarApp a true y se manda el evento de cerrar la aplicación</li>
 * </ul>
 * @method antesCerrarAplicacion
 * @return null
 */
function antesCerrarAplicacion() {
	if (watcher != null) {
		watcher.close();
	}
	//Eliminar fichero .lock si se ha llegado a subir
	if (modeloLogin != null) {
		var lockFile = upath.joinSafe(rutaDefecto, modeloLogin.usuario) + ".lock";
		controlador.eliminaFicheroLock(lockFile, function (ficheroEliminado) {
			if (ficheroEliminado)
				log.info("fichero lock eliminado");
			else
				log.error("fichero lock no eliminado");
			cierraApp = true
			mainWindow.close();
		});
	}
	else {
		cierraApp = true
		mainWindow.close();
	}
}
/**
 * Cuando todas las ventanas esten cerradas se cierra la aplicación
 * @event app.on(window-all-closed
 * @param {Function} app.quit 
 */
app.on('window-all-closed', app.quit);