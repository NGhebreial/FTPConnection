/**
 * http://usejsdoc.org/
 */
var fs = require('fs');
var JSFtp = require("jsftp");
const upath = require('upath');
const host=require("./datosServer.json")["host"];
const login=require("./datosServer.json")["usuarioLog"];
const pass=require("./datosServer.json")["passLog"];

module.exports = function envioLog(dir, usuario, mensajeEnviado){
	var ficheroLog = fs.readFileSync(dir, 'utf8');
	
	var Ftp = new JSFtp({
		  host: host,
		  port: 21, // defaults to 21 
		});
	
	Ftp.auth(login, pass, function(err, res) {
		if(err){
			console.log( "error en el login", err );
		}
		else{
			var log =dir.substring( dir.lastIndexOf("/"));
			var carpetaDeUsuario = upath.joinSafe("/logsClientes" ,"/", usuario)
			Ftp.raw("mkd", "/logsClientes", function(err, data) {
				Ftp.raw("mkd", carpetaDeUsuario, function(err, data) {
					var destino = upath.joinSafe(carpetaDeUsuario, log)
					Ftp.put(dir, destino, function(hadError) {
						Ftp.raw("quit", function(err, data) {
							if (!hadError){
								console.log("log subido")
								mensajeEnviado('OK');
							}			
							else{
								mensajeEnviado(hadError);
							}
						});
					});
				});
			});
		}
	});
}