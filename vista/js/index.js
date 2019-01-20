/**
 * Pantalla principal. <br/>
 * Visualizacion de la pantalla de login, logos y links a paginas web de referencia
 * y avisos y bloqueos en caso de haber una actualización
 * @module indexView
 */
const shell = require('electron').shell;
const Router = require('electron-router');
$(document).ready(function() {
	$("#cajaDescargaNuevaVersion").hide();
	const shell = require('electron').shell;
	var router = Router('MAIN');
	var versionJSON=require("../../package.json")["version"];
	document.title = 'FTP conexión '+versionJSON;
	
	router.on("datosLogin", function(usuario, password, url, puerto){
		 $("#usuario").val(usuario);
		 $("#password").val(decrypt(password));
		 $("#url").val(url);
		 $("#puerto").val(puerto);
	});	   

	
	$("#descargaNuevaVersion").on('click', function(event) {
	    event.preventDefault();
	    shell.openExternal(this.alt);
	    //Cerrar el programa cuando se vaya a descargar la actualizacion
	    router.send("cerrarFTP");
		router.clean();
	});
	
	//Existe el fichero .lock
	router.on("ficheroBloqueado", function(){
		if (confirm('Hay alguien conectado a esta carpeta, ¿Estas seguro de continuar? algunos cambios sobre ficheros podrían sobreescribirse')){
			router.send("cargaVistaFicheros");
		}
	});
	
	router.on("actualizacionObligatoria", function(version){
		alert("Hay una nueva versión del programa. Por favor, instala la nueva versión antes de continuar");
		$("#cajaDescargaNuevaVersion span").html("Versión "+version);
		$("#cajaDescargaNuevaVersion").show();
	});
	router.on("actualizacionOpcional", function(version){
		asociaClick();
		if (confirm("Hay una nueva versión del programa, ¿quieres descargarla?")){
			router.send("descargaActualizacion");
		}
		else{
			$("#cajaDescargaNuevaVersion span").html("Versión "+version);
			$("#cajaDescargaNuevaVersion").show();
		}
	});
	router.on("sinActualizacion", function(){
		asociaClick();
	});
	router.on("errorLogin", function(){
		$("#usuario").val("");
		$("#password").val("");
		alert("El usuario o la contraseña introducidos no son correctos.");
	});
	router.clean();
});
/**Asocia la funcion click al boton de logado*/
function asociaClick(){
	//Para cuando pulsamos tecla intro
	$(document).keypress(function(e){
		if(e.which===13){
			login(e);
		}
	});
	$("#login").on("click", login);	
}
/**Funcionalidad de login completa:
 * - Usuario y contraseña != null
 * - Conexion con FTP llamando al controlador
 * 	- datos ok o datos erroneos
 * - Peticion de la lista de ficheros al controlador*/
function login(evento){
	var router = Router('MAIN');		
	if($("#usuario").val()!="" && $("#password").val()!="" 
	&& $("#url").val()!="" && $("#puerto").val()!=""){
		//Para la opción de recordar datos
		var recordar=true;
		if(!$("#recordar").is(':checked')){
			recordar=false;
		}
		router.send("login", {
			"usuario": $("#usuario").val(), 
			"password":  $("#password").val(),
			"url":  $("#url").val(),
			"puerto":  $("#puerto").val(),
			"recordar": recordar
		});
	}
	else
		alert("Debes introducir usuario y contraseña");	
}

//Función para desencriptar password
function decrypt(text){
	// Nodejs encryption with CTR
	var crypto = require('crypto'),
	    algorithm = 'aes-256-ctr',
	    password = 'ftp2019';
	var decipher = crypto.createDecipher(algorithm,password);
	var dec = decipher.update(text,'hex','utf8');
	dec += decipher.final('utf8');
	return dec;
}