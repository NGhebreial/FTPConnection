'use strict';
/**
 * <strong> Lógica de negocio. </strong>
 * <ol>
 *  <li> Realiza la comunicación con la clase de FTP que hace las conexiones </li>
 * 	<li> Métodos para encapsular las peticiones al FTP </li>
 *  <li> Presenta los datos encapsulandolo en el modeloFichero para su envío a la clase que hizo la petición </li>
 *  <li> El constructor de este objeto hace la instancia del objeto FTP y del modelo login  </li>
 * </ol>
 * @class controlador
 * @constructor
 */

/**
 * Objeto auxiliar donde se almacenan los datos de login para su utilizanción a lo largo de la ejecución del programa
 * @property modeloLogin
 * @type Object
 */
var modeloLogin = require("../modelo/modeloLogin.js");

/**
 * Modulo para la conexión mediante FTP 
 * @property ftp
 * @type Object
 */
var ftp = require("../ftpConexion.js");

/**
 * Objeto auxiliar con la estructura de los ficheros recogidos del FTP
 * @property modeloFichero
 * @type Object
 */
var modeloFichero = require("../modelo/modeloFichero.js");

/**
 * Modulo para la comunicación entre clases.<br/> 
 * Este modulo es el que hace toda la magia de comunicación con envío y recepción de parametros
 * @property Router
 * @type Object

 */
const Router = require('electron-router');
/**
 * Modulo nativo de node para el tratamiento de ficheros
 * @property fsExtra
 * @type Object
 */
var fs = require('fs');
/**
 * Modulo la lectura de paths de forma segura e independiente del sistema operativo.<br/> 
 * Ofrece ampliacion de funciones sobre el modulo path
 * @property upath
 * @type Object
 */
const upath = require('upath');
/**
 * Modulo para la ejecución de funciones sincrona.<br/>
 * Se esta usando para recorrer ficheros y su posterior tratamiento de forma secuencial
 * @property async
 * @type Object
 */
const async = require('async');
/**
 * Modulo para el tratamiento de ficheros de log
 * @property log
 * @type Object
 */
var log = require('electron-log');
/**
 * Variable que indica a que indice del array estan asociados los ficheros
 * @property ficheroIndice
 * @type Integer
 */
var ficheroIndice = 0;
/**
 * Variable que indica a que indice del array estan asociados los directorios
 * @property carpetaIndice
 * @type Integer
 */
var carpetaIndice = 1;

function controlador(){
	ftp = new ftp();
	modeloLogin = new modeloLogin();
}

/**
 * Realiza la conexión al FTP almacenando en un objeto modeloLogin los datos de conexión.<br/> 
 * Si hay error se devuelve false y null.<br/>
 * Si no hay error se devuelve null y el objeto modeloLogin
 * @method compruebaLogin
 * @param {String} usuario el nombre de usuario para hacer login
 * @param {String} pass la contraseña para hacer login
 * @param {callback} datosConexion el resultado de la conexion
 * @return error, modelo de login
 */
controlador.prototype.compruebaLogin = function(usuario, pass, url, puerto, datosConexion){
	ftp.conecta(usuario, pass, url, puerto, function(resp){
		ftp.desconecta(function(){
			if(resp){			
				modeloLogin.setUsuario(usuario);
				modeloLogin.setPassword(pass);
				modeloLogin.setUrl(url);
				modeloLogin.setPuerto(puerto);
				datosConexion(null, { "modelo": modeloLogin})
			}
			else{
				datosConexion(false, null);
			}
		});
	});
};
/**
 * Recoge la lista de ficheros de una ruta en concreto
 * Setea la lista de ficheros en un array de objetos modeloFichero
 * Devuelve la respuesta en un callback
 * @method listaFicheros
 * @param {String} ruta la ruta de origen de datos
 * @param {callback} callback el resultado
 * @return error, array de modelo de fichero
 * */
controlador.prototype.listaFicheros = function(ruta, callback){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.listaFicheros(ruta, function(err, resp){
			ftp.desconecta(function(){
				var ficheros = [];
				if(resp){					
					resp.forEach(function(file) {
						var esLock = file.name.split('.').pop() == "lock";
						var esThumbDB = file.name.toLocaleLowerCase() === "thumbs.db";
						var esTemporal = file.name.toLocaleLowerCase().includes( "~$" );
						if(!esLock && !esThumbDB && !esTemporal){
							var tipo;
							//tipo 0 = fichero
							if(file.type === ficheroIndice)
								tipo = "file";
							else
								tipo = "dir";
							var nombre = String(file.name, "utf8");
							ficheros.push(new modeloFichero(nombre, ruta+"/"+nombre, tipo, file.time, new Date(file.time).toUTCString(), file.size));	
						}					
					});
					callback(null, ficheros);
				}	
				else{
					callback(err, ficheros);
				}
			});

		});
	});

};

/**
 * Descarga el fichero del FTP a la ruta de destino indicada. 
 * @method descargaFichero
 * @param {String} rutaOrigen la ruta de origen
 * @param {String} rutaDestino la ruta de destino
 * @param {callback} callback el resultado
 * @return error, descargado 
 */
controlador.prototype.descargaFichero = function(rutaOrigen, rutaDestino, callback){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.descargaFichero(rutaOrigen, rutaDestino, function(error, descargado) {
			ftp.desconecta(function(){
				callback(error, descargado);
			});
		})
	});
};

/**
 * Comprueba si existe el fichero pasado por parametro
 * @method descargaFichero
 * @param {String} ruta la ruta de destino
 * @param {callback} callback el resultado
 * @return error, existeFichero 
 */
controlador.prototype.ficheroBloqueado = function(ruta, callback){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.existeFichero(ruta, function(error, existeFichero) {
			ftp.desconecta(function(){
				if ( error && error.toString().includes("550")){
					callback(null, existeFichero);
				}
				else{
					callback(error, existeFichero);
				}
			});
		});
	});
};

/**
 * Sube un fichero indicando solo la ruta. Para subir el fichero lock que no tiene contenido
 * @method subeFicheroLock
 * @param {String} ruta la ruta de destino
 * @param {callback} ficheroSubido el resultado
 * @return hadError, subido 
 */
controlador.prototype.subeFicheroLock = function(ruta, ficheroSubido){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.subeFicheroSoloRuta(ruta, function(hadError, subido) {
			ftp.desconecta(function(){
				if(hadError){
					log.error("error subiendo el fichero lock", hadError)					
				}
				ficheroSubido(hadError, subido);	
			});

		});
	});
};

/**
 * Sube un fichero indicando la ruta de origen para la descarga y el destino para depositarlo
 * @method subeFichero
 * @param {String} rutaOrigen la ruta de origen
 * @param {String} rutaDestino la ruta de destino
 * @param {callback} ficheroSubido el resultado
 * @return hadError 
 */
controlador.prototype.subeFichero = function(rutaOrigen, rutaDestino, ficheroSubido){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.subeFichero(rutaOrigen, rutaDestino, function(hadError) {
			ftp.desconecta(function(){
				if(hadError){
					ficheroSubido(false);
				}
				else
					ficheroSubido(true);	
			});
		});		
	});
};

/**
 * Sube una lista de ficheros haciendo un bucle sincrono:
 * <ol>
 * 	<li> Hace la conexion </li>
 * 	<li> Coge los datos del fichero para construir la ruta </li>
 * 	<li> Sube el fichero al ftp </li>
 * 	<li> Hace la desconexion </li>
 * </ol>
 * @method subeFicheros
 * @param {Array[modeloFichero]} ficheros los ficheros para subir
 * @param {String} pathFichero la ruta de destino
 * @param {callback} ficheroSubido el resultado
 * @return ficheroSubido 
 */
controlador.prototype.subeFicheros = function(ficheros, pathFichero, ficheroSubido){
	var ficherosSubidos = true;
	var i = -1;
	async.whilst(
			function(){ i++; return i < ficheros.length },
			function(callback){
				ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
					modeloLogin.puerto, function(resp){
					var fichero = ficheros[i];
					var rutaDestino =upath.joinSafe(pathFichero , fichero.nombre);
					var rutaOrigen = upath.normalize(fichero.ruta);
					ftp.subeFichero(rutaOrigen, rutaDestino, function(hadError) {
						ftp.desconecta(function(){
							if(hadError){
								callback(hadError, i)
							}
							else{
								log.info('Fichero subido ', rutaOrigen);
								callback(null, i)
							}
						});	
					});
				});
				// if any of the saves produced an error, err would equal that error
			}, function(err) {
				// if any of the file processing produced an error, err would equal that error
				if( err ) {
					log.error('A file failed to process ', fichero);
					ficheroSubido(false);
				} 
				else {
					ficheroSubido(true);
				}
			});
};

/**
 * Elimina el fichero lock
 * @method eliminaFicheroLock
 * @param {String} ruta el directorio de destino
 * @param {callback} callback
 * @return ficheroEliminado 
 */
controlador.prototype.eliminaFicheroLock = function(ruta, callback){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.eliminaFichero(ruta, function(ficheroEliminado) {
			ftp.desconecta(function(){
				callback(ficheroEliminado);	
			});
		});
	});
};

/**
 * Crea un directorio en la ruta pasada por parametro.<br/>  
 * Si se recibe un error 550 es porque ya existe un directorio con ese nombre 
 * @method nuevaCarpeta
 * @param {String} ruta el directorio de destino
 * @param {callback} callback
 * @return error, creada  
 */
controlador.prototype.nuevaCarpeta = function(ruta, callback){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.nuevaCarpeta(ruta, function(error, creada) {
			ftp.desconecta(function(){
				//550 el fichero ya existe
				if(error &&  error.toString().includes("550") ){
					callback("carpetaExisteEnDirectorio", null);		
				}
				else{
					callback(null, creada);
				}
			});
		});
	});
};

/**
 * Recoge el fichero solicitado del FTP y setea la fecha y el tamaño. <br/>  
 * Si se recibe un error 550 es porque ya existe un directorio con ese nombre 
 * @method fechaFichero
 * @param {String} ruta el directorio de destino
 * @param {callback} callback
 * @return error, datos de fecha y tamaño  
 */
controlador.prototype.fechaFichero = function(ruta, callback){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.listaFicheros(ruta, function(error, resp){
			ftp.desconecta(function(){
				if(resp){
					callback(null, {"fecha": new Date(resp[0].time), "size": resp[0].size});	

				}
				else{
					callback(error, null);
				}
			});
		});
	});
};

/**
 * Cambia el directorio seleccionado de localizacion. <br/>  
 * Si se recibe un error 550 es porque ya existe un directorio con ese nombre 
 * @method cambiaCarpetaFichero
 * @param {String} from el directorio de origen
 * @param {String} to el directorio de destino
 * @param {callback} cambiado 
 * @return error, creada  
 */
controlador.prototype.cambiaCarpetaFichero = function(from, to, cambiado){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.cambiaCarpeta(from, to, function(error, resp){
			ftp.desconecta(function(){
				//550 el fichero ya existe
				if( error && error.toString().includes("550") ){
					cambiado("ficheroExisteEnDirectorio", null);		
				}
				else{
					cambiado(null, resp);
				}

			});
		});
	});
};

/**
 * Elimina el directorio seleccionado de forma recursiva. <br/> 
 * @method eliminaCarpeta
 * @param {String} ruta el directorio a recorrer para eliminar
 * @param {callback} callback ruta en local donde se descargara el fichero
 * @return carpetaEliminada  
 */
controlador.prototype.eliminaCarpeta = function(ruta, callback){
	recorreFicheros(ruta, function(err){
		ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
			modeloLogin.puerto,function(conectado){
			ftp.eliminaCarpeta(ruta, function(carpetaEliminada) {
				ftp.desconecta(function(){
					callback(carpetaEliminada);	
				});

			});
		});
	});
};
/**
 * Elimina directorios de forma recursiva con un recorrido del arbol de ficheros en preorden
 * <ol>
 * 	<li> Se hace conexion</li>
 * 	<li> Se solicita la lista de ficheros de la ruta pasada por parametro</li>
 * 	<li> Se hace desconexion </li>
 * 	<li> Se recorren los ficheros recogidos </li>
 * 	<li> Si es un fichero:  
 * 		<ol>
 * 			<li>Se hace conexion </li>
 * 			<li>Se elimina </li>
 * 			<li>Se hace desconexion </li>
 * 		</ol>
 * 	</li>
 *  <li> Si es un directorio:  
 * 		<ol>
 * 			<li>Se llama a la función de forma recursiva </li>
 * 			<li>Se hace conexion </li>
 * 			<li>Se elimina el directorio </li>
 * 			<li>Se hace desconexion </li>
 * 		</ol>
 * 	</li>
 * </ol>
 * @method recorreFicheros
 * @param {String} ruta el directorio a recorrer para eliminar
 * @param {callback} finEliminar 
 * @return callback de fin de eliminado
 */
function recorreFicheros(ruta, finEliminar){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(conectado){
		ftp.listaFicheros(ruta, function(error, resp){
			ftp.desconecta(function(desconectado){	
				var i = -1;
				async.whilst(
						function(){ i++; return i < resp.length },
						function(callback){	

							var file = resp[i];
							var rutaCompleta = upath.joinSafe(ruta, file.name);
							if ( file.type === ficheroIndice ){
								ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
									modeloLogin.puerto,function(conectado){
									ftp.eliminaFichero(rutaCompleta, function(ficheroEliminado) {
										ftp.desconecta(function(){
											log.info("fichero eliminado recursivo", rutaCompleta)
											callback(null, i)
										});
									});
								});
							}
							else{
								recorreFicheros(rutaCompleta, function(err){
									ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
										modeloLogin.puerto,function(conectado){
										ftp.eliminaCarpeta(rutaCompleta, function(carpetaEliminada) {
											ftp.desconecta(function(){
												log.info("carpeta eliminada recursivo", rutaCompleta)
												callback(null, i)
											});
										});
									});
								});
							}

						}, function(err) {
							finEliminar(err)
							return err
						});
			});

		});
	});

}
/**
 * Elimina el fichero de la ruta recogida por parametro 
 * @method eliminaFichero
 * @param {String} ruta el directorio a recorrer para eliminar
 * @param {callback} callback respuesta
 * @return ficheroEliminado  
 */
controlador.prototype.eliminaFichero = function(ruta, callback){
	ftp.conecta(modeloLogin.usuario, modeloLogin.password, modeloLogin.url, 
		modeloLogin.puerto,function(resp){
		ftp.eliminaFichero(ruta, function(ficheroEliminado) {
			ftp.desconecta(function(){
				callback(ficheroEliminado);	
			});
		});
	});
};

module.exports = controlador;