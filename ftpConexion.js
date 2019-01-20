'use strict';
/**
 * <strong> Conexión y comunicación con la librería que gestiona las peticiones con FTP. </strong>
 * <ol>
 *  <li> Realiza la comunicación con la clase de FTP que hace las conexiones </li>
 * 	<li> Métodos para encapsular las peticiones al FTP </li>
 *  <li> Presenta los datos encapsulandolo en el modeloFichero para su envío a la clase que hizo la petición </li>
 *  <li> El constructor de este objeto hace la instancia del objeto FTP y del modelo login  </li>
 * </ol>
 * @class controlador
 * @constructor
 */

const Router = require('electron-router');
var JSFtp = require("jsftp");
var log = require('electron-log');
const fs = require('fs');
var Ftp;
var router = Router('MAIN');
function conexionFTP(){
}
/**Funcion conecta -> conecta al FTP con el usuario y pass recogidos
 * Devuelve un callback con true si todo ha ido bien o false si ha habido error*/
conexionFTP.prototype.conecta = function(usuario, password, url, puerto, callback){
	var host = require("./datosServer.json")["host"];
	Ftp = new JSFtp({
		host: url,
		port: puerto, // defaults to 21 
	});
	Ftp.auth(usuario, password, function(err, res) {
		if(err){
			log.error("ERROR logando", err);
			callback( false );
		}
		else{
			callback( true );
		}
	});

	Ftp.on('error', function (exc) {		
		if(!exc.toString().includes("ECONNRESET")){
			log.error("ERROR en FTP ", exc);				
			router.send("cerrarFTP", "errorGrave");
			router.clean();
		}

	});

	Ftp.on('timeout', function () {
		log.error("TIMEOUT en FTP ");
	});
};
/**Recoge la lista de ficheros de la carpeta FTP y lo envia todo en un callback*/
conexionFTP.prototype.listaFicheros = function(ruta, callback){
	Ftp.ls(ruta, function(err, res) {
		callback(err, res);		
	});

};
/**Sube un fichero en la ruta seleccionada*/
conexionFTP.prototype.subeFicheroSoloRuta = function(rutaDestino, callback){
	Ftp.put(new Buffer(10), rutaDestino, function(hadError) {		
		if (!hadError){
			callback(hadError, true);
		}
		else{
			callback(hadError, false);
		}

	});
};
/**Sube un fichero en la ruta seleccionada desde la ruta elegida*/
conexionFTP.prototype.subeFichero = function(rutaOrigen, rutaDestino, callback){
	log.info("antes de subir el fichero", rutaDestino)
	Ftp.put(rutaOrigen, rutaDestino, function(hadError) {
		console.log("ENTRA");
		if (!hadError){
			callback(false);
		}			
		else{
			log.error("subeFichero, se va a cerrar el programa", rutaDestino ,hadError.toString());
			/*ECONNREFUSED es un error que deja el programa bloqueado por culpa del FTP
			 * y no hay mas, asi que mostramos una pantalla de bloqueo y le decimos que se esta 
			 * cerrando el programa*/
			router.send("cerrarFTP", "errorGrave");
			router.clean();
			callback(true);
		}
	});
};
/**Comprueba si existe el fichero seleccionado*/ 
conexionFTP.prototype.existeFichero = function(ruta, callback){
	Ftp.get(ruta, function(err, socket){
		if (err){
			callback(err, false);
		} 
		else{
			socket.resume();
			callback(null, true);
		}
	});
};
/**Descarga el fichero seleccionado*/
conexionFTP.prototype.descargaFichero = function(rutaOrigen, rutaDestino, callback){
	Ftp.get(rutaOrigen, function(err, socket) {
		if (err){
			log.error("Error descargando fichero", err)
			callback(err, false);
			return;
		}
		var data=new Buffer('');
		socket.on("data", function(d) {
			if (data===undefined){ 
				data = d;
			}
			else{
				data = Buffer.concat([data, d ]);
			}

		});
		socket.on("close", function(hadErr) {
			if (hadErr){
				callback(hadErr, false);
				log.error('There was an error retrieving the file.', hadErr);
			}
			else{
				fs.writeFile(rutaDestino,data, function(err) {
					if(err) {
						log.error("error descargando fichero", err)
						callback(err, false);
					}
					else{
						callback(null, true);
					}		    	    
				}); 
			}
		});
		socket.resume();
	});
};
/**Elimina fichero*/ 
conexionFTP.prototype.eliminaFichero = function(ruta, callback){
	Ftp.raw("dele",ruta, function(err, data) {
		if (err){
			log.error("Error eliminando fichero",ruta, err)
			callback(false);
		}			
		else
			callback(true);
	});
};

conexionFTP.prototype.eliminaCarpeta = function(ruta, callback){
	Ftp.raw("rmd", ruta, function(err, data) {
		if (err){
			log.error("Error eliminando carpeta",ruta, err)
			callback(false);
		}			
		else
			callback(true);
	});
};

/**Nueva carpeta en la ruta indicada*/
conexionFTP.prototype.nuevaCarpeta = function(ruta, callback){
	Ftp.raw("mkd", ruta, function(err, data) {
		if (err){
			log.error("Error al crear carpeta", err)
			callback(err, false);
		}

		else{
			callback(null, true);
		}

	});
};
/**Desconecta*/
conexionFTP.prototype.desconecta = function(callback){
	Ftp.raw("quit", function(err, data) {
		if (err){
			log.error("Error desconectando", err)
			callback(false);
		}

		else{
			callback(true);
		}
	});
}

/**Cambia el fichero de carpeta*/
conexionFTP.prototype.cambiaCarpeta = function(from, to, callback){
	Ftp.rename(from, to, function(err, res) {		
		if (!err){
			callback(null, true)
		}
		else{
			callback(err, false)
		}
	});
};
module.exports = conexionFTP;