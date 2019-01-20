/**
 * http://usejsdoc.org/
 */
const shell = require('electron').shell;
const Router = require('electron-router');
var router = Router('MAIN');
const rutaDefecto=require("../../datosServer.json")["ruta"];
var modeloFichero = require("../../modelo/modeloFichero.js");
var notifier = require('node-notifier');
const upath = require('upath');
const flechaRutaNavegacion="<img class='flechaRutaNavegacion' alt='flecha' src='../css/images/flecha.png'/>";
var dateFormat = require('dateformat');
dateFormat.masks.hammerTime = "dd/mm/yyyy, HH:MM:ss";
//Para la ordenacion de ficheros
var listaFicheros = [];
var ordenacion = "asc";
var myDropzone;
var archivoSeleccionado="";


//Indices para el array de fichero
const indiceTipo = 0;
const indiceNombre = 1;
const indiceRuta = 2;
const indiceFecha = 3;
//Regex para los nombres de ficheros en windows
const rg1=/^[^\\/:\*\?"<>\|]+$/; // forbidden characters \ / : * ? " < > |
const rg2=/^\./; // cannot start with dot (.)
const rg3=/^(nul|prn|con|lpt[0-9]|com[0-9])(\.|$)/i; // forbidden file names

function block(){
	$.blockUI({message: '<h2>Espere, por favor ...</h2>'});
}

function blockActualizacion(){
	var msg = '<h2>Descarga la actualización,<br>por favor</h2>'+
	'<img class="imgDescargaNuevaVersion" alt="/ftpConexionDescarga.html" src="../css/images/descargar.png" title="Descargar Actualización" style="width: 88px; cursor:pointer;important!"/>';
	$.blockUI({message: msg});
	clickDescarga();
}

$(document).ready(function() {
	
	$("#imgDescargaNuevaVersion").hide();
	$("#cajaOpcionesFichero").hide();	
	$("#cajaOpcionesMoverFichero").hide();
	$("#cajaOpcionesCarpeta").hide();
	eventosClick();
	//Configuracion dropzone	
	dropzoneFichero();

	eventosRouter();

	//Para poner una nueva carpeta
	gestionaNuevaCarpeta();
	router.clean();
});

/**Recoge la lofica de cada click sobre cada elemento*/
function eventosClick(){
	//Mostra ocultar
	$("#subirFichero").on("click", cajaFormularioFicheros);
	$("#subirFicherosDropzone").on("click", function(){
		if(myDropzone.files.length== 0){
			alert("Selecciona algún fichero para añadir")
		}
		else{
			block();
			var modelos =[];
			$.each(myDropzone.files, function(key, value){
				var file = $(this)[0]
				var mod = new modeloFichero(file.name, upath.normalize(file.path), "file", file.lastModified, file.size)
				modelos.push(mod);
				myDropzone.removeFile(file);
			});
			router.send("subeFicheros",{"modelos": modelos, "rutaActual":$("#ruta").val()});
			cajaFormularioFicheros();
		}
	});
	$("#manualUsuario").on('click', function(event) {
		event.preventDefault();
		shell.openExternal(this.name);
	});

	$("#principal").on("click", function(){
		$.unblockUI();
		router.send("abrirCarpeta", { "ruta": rutaDefecto});
	});
	$("#errorSend").on("click", function(){
		router.send("cerrarFTP","errorGrave");
	});
	$("#refrescar").on("click", function(){
		router.send("abrirCarpeta", { "ruta": $("#ruta").val()});
	});
	//Quit when click on exit.
	$("#salir").on("click", function(){
		router.send("cerrarFTP");
		router.clean();
	});
	//Ordenacion
	$("#ordenaNombre").on("click", function(){
		if(ordenacion==="asc"){
			$(this).attr("src", "../css/images/flechaUp.png");
			ordenacion = "desc";
		}
		else{ 
			$(this).attr("src", "../css/images/flechaDown.png")
			ordenacion = "asc";
		}
		muestraListaFicheros();
	});

	/*Acciones de fichero*/
	$("#descargaFichero").off("click")
	$("#descargaFichero").on("click", function(){
		if ( archivoSeleccionado !== "" ){
			//Para quitar el nombre del fichero de la ruta
			var nombreEscapado= archivoSeleccionado[indiceNombre].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
			var rutaRecortada=archivoSeleccionado[indiceRuta].replace(new RegExp(nombreEscapado+ '$'), '')
			router.send("abrirFichero", {"nombre": archivoSeleccionado[indiceNombre], "ruta": rutaRecortada, "fecha":archivoSeleccionado[indiceFecha]});

			quitaSeleccionArchivo();
		}
		else{
			alert( "Selecciona un fichero para descargar" );
		}

	});	

	$("#eliminaFichero").off("click")
	$("#eliminaFichero").on("click", function(){
		dialogoEliminar("¿Seguro que quieres eliminar el fichero? No se podrá recuperar el contenido",
		"Eliminar fichero", "eliminaFichero");
	});


	/*Acciones de carpeta*/
	$("#abrirCarpeta").off("click")
	$("#abrirCarpeta").on("click", function(){
		router.send("abrirCarpeta", { "ruta": archivoSeleccionado[indiceRuta]});
		block();
	});

	$("#eliminaCarpeta").off("click")
	$("#eliminaCarpeta").on("click", function(){
		dialogoEliminar("¿Seguro que quieres eliminar la carpeta? Se eliminarán todos los ficheros y carpetas que estén contenidos",
				"Eliminar carpeta y ficheros contenidos", "eliminaCarpeta");
	});

	//Acciones comunes con ficheros y carpetas
	$(".moverArchivo").off("click")
	$(".moverArchivo").on("click", function(){
		$("#cajaIconosCabecera").hide();
		$("#cajaOpcionesFichero").hide();
		$("#cajaOpcionesCarpeta").hide();		
		$("#cajaOpcionesMoverFichero").show();
		desSeleccionArchivo();
	});

	$("#cambiarArchivoCarpeta").off("click")
	$("#cambiarArchivoCarpeta").on("click", function(){
		var rutaTo = upath.joinSafe( $("#ruta").val() , archivoSeleccionado[indiceNombre] );
		router.send("cambiaArchivoCarpeta", {"from": archivoSeleccionado[indiceRuta], "to": rutaTo, "rutaDestino":$("#ruta").val() });		
		block();
		quitaSeleccionArchivo();
	});

	$(".cancelar").off("click")
	$(".cancelar").on("click", function(){
		quitaSeleccionArchivo();
		seleccionFichero();
		seleccionCarpeta();
	});

}

/**Quita la clase selected del fichero que lo tenga y
 * se muestran los iconos globales ocultando los iconos de fichero*/
function quitaSeleccionArchivo(){
	$("#cargaFicheros").find(".selected").removeClass("selected");
	archivoSeleccionado = "";
	
	$("#cajaIconosCabecera").show();

	$("#cajaOpcionesFichero").hide();
	$("#cajaOpcionesCarpeta").hide();
	$("#cajaOpcionesMoverFichero").hide();

}

/**Funcion para no permitir los click sobre los ficheros y carpetas
 * cuando se estan subiendo ficheros*/
function cajaFormularioFicheros(){
	$("#formFile").slideToggle();
	$.each($(".fileClick"), function(key, value){
		if($(this).hasClass("disabled"))
			$(this).removeClass("disabled");
		else
			$(this).addClass("disabled");
	});
	$("#cajaInputSubeFichero").slideToggle();
}


/**Si hay un solo click sobre ficheros o carpetas -> mostrar las posibles opciones:
 * - descargar
 * - eliminar
 * - mover*/
function seleccionFichero(){
	$(".esFichero").off("contextmenu");
	$(".esFichero").on("contextmenu", function(){
		if( !$(this).hasClass("disabled") ){
			//Si no esta seleccionado pero hay alguno seleccionado
			if ( !$(this).hasClass("selected") ){				
				//Si hay uno anterior -> quitar clase y no hacer toogle
				if ( $("#cargaFicheros").find(".selected")[0] ){
					$("#cargaFicheros").find(".selected").removeClass("selected");
				}
				$("#cajaIconosCabecera").hide();
				$("#cajaOpcionesFichero").show();
				$("#cajaOpcionesCarpeta").hide();
				$("#cajaOpcionesMoverFichero").hide();

				$(this).addClass("selected");
				archivoSeleccionado =  $(this).attr("id").split("||");
			}
			else{
				quitaSeleccionArchivo();
			}			
		}
	});
}

/**Si hay un solo click sobre ficheros o carpetas -> mostrar las posibles opciones:
 * - navegar
 * - eliminar
 * - mover*/
function seleccionCarpeta(){
	$(".esCarpeta").off("contextmenu");
	$(".esCarpeta").on("contextmenu", function(){
		if( !$(this).hasClass("disabled") ){
			//Si no esta seleccionado pero hay alguno seleccionado
			if ( !$(this).hasClass("selected") ){				
				//Si hay uno anterior -> quitar clase y no hacer toogle
				if ( $("#cargaFicheros").find(".selected")[0] ){
					$("#cargaFicheros").find(".selected").removeClass("selected");
				}
				$("#cajaIconosCabecera").hide();
				$("#cajaOpcionesFichero").hide();
				$("#cajaOpcionesCarpeta").show();
				$("#cajaOpcionesMoverFichero").hide();

				$(this).addClass("selected");
				archivoSeleccionado =  $(this).attr("id").split("||");
			}
			else{
				quitaSeleccionArchivo();
			}			
		}
	});
}
/**Impide seleccionar un archivo cualquiera cuando se 
 * esta moviendo otro archivo*/
function desSeleccionArchivo(){
	$(".esCarpeta").off("contextmenu");
	$(".esFichero").off("contextmenu");
}
/**Eventos asociados a los ficheros --> necesario recargar estos eventos con cada carga de ficheros*/
function abreArchivo(){
	var ultimoClick = "";

	$(".fileClick").off("click");
	$(".fileClick").on("click", function(){
		if(!$(this).hasClass("disabled")){
			//Para evitar dobles click en ficheros y carpetas
			if(ultimoClick !== $(this).attr("id")){
				ultimoClick = $(this).attr("id");
				var datoFichero = $(this).attr("id").split("||");
				if(datoFichero[indiceTipo] === "file"){
					//Para quitar el nombre del fichero de la ruta
					var nombreEscapado= datoFichero[indiceNombre].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
					var rutaRecortada=datoFichero[indiceRuta].replace(new RegExp(nombreEscapado+ '$'), '')
					router.send("abrirFichero", {"nombre": datoFichero[indiceNombre], "ruta": rutaRecortada, "fecha":datoFichero[indiceFecha]});
					quitaSeleccionArchivo();
				}
				else{
					router.send("abrirCarpeta", { "ruta": datoFichero[indiceRuta]});
					if( $("#cajaOpcionesMoverFichero").is(":hidden") ){
						quitaSeleccionArchivo();
					}
					block();
				}
			}
			setTimeout(function(){ultimoClick=""}, 2000);
		}		
	});
	$(".ruta").off("click");
	$(".ruta").on("click", function(){
		if( $("#cajaOpcionesMoverFichero").is(":hidden") ){
			quitaSeleccionArchivo();
		}
		var rutaRecogida = $(this).attr("id");
		//Si es inicio -> ir a la carpeta por defecto
		if(rutaRecogida==="Inicio"){
			$.unblockUI();
			router.send("abrirCarpeta", { "ruta": rutaDefecto});
		}
		//Si no es inicio -> ir directamente
		else{
			$.unblockUI();
			router.send("abrirCarpeta", { "ruta": rutaRecogida});
			generaRutaNavegacion(rutaRecogida);
		}
	});
}

/**Genera visualmente la ruta para poder hacer click sobre ella*/
function generaRutaNavegacion(ruta){
	var rutaCompleta=rutaDefecto;
	var nuevaRuta="";
	var rutas = ruta.split("/");
	for(var i=1; i<rutas.length; i++){
		rutaCompleta= upath.joinSafe(rutaCompleta, rutas[i]);
		if(rutas[i]!=""){
			if(rutas[i].length<15)
				nuevaRuta += "<span id='"+rutaCompleta+"' class='ruta'>" + rutas[i] + "</span>"+flechaRutaNavegacion;
			else{
				var rutaI=rutas[i];
				rutas[i]=rutas[i].substring(0,15)+"...";
				nuevaRuta += "<span id='"+rutaCompleta+"' title='"+rutaI+"' class='ruta'>" + rutas[i] + "</span>"+flechaRutaNavegacion;
			}
		}
	}
	$("#rutaNavegacionAmpliada").html(nuevaRuta);
}

/**Devuelve un valor para ordenación según nombre ascendente*/
function ordenaAsc(ficheroA, ficheroB){
	var nameA=ficheroA.nombre.toLowerCase(), nameB=ficheroB.nombre.toLowerCase();
	if (nameA < nameB) //sort string ascending
		return -1;
	if (nameA > nameB)
		return 1;
	return 0;
}

/**devuelve un valor para ordenación según nombre descendente*/
function ordenaDesc(ficheroA, ficheroB){
	var nameA=ficheroA.nombre.toLowerCase(), nameB=ficheroB.nombre.toLowerCase();
	if (nameA > nameB) //sort string descending
		return -1;
	if (nameA < nameB)
		return 1;
	return 0;
}

/**Gestiona la funcionalidad de mostrar y ocultar el input
 * y el envio de datos por router al darle a ok */
function gestionaNuevaCarpeta(){
	$("#cajaInputCarpeta").hide();
	$("#nuevaCarpeta").on("click", function(){
		$("#cajaInputCarpeta").slideToggle();
		$("#nombreNuevaCarpeta").focus();
	});
	$("#ok").on("click", function(){
		var  nombreCarpeta=  $("#nombreNuevaCarpeta").val();
		if( nombreCarpeta !=null && nombreCarpeta !=""){
			if ( nombreCarpetaValido(nombreCarpeta) ){
				router.send("nuevaCarpeta",{"ruta": $("#ruta").val(), "nombre": $("#nombreNuevaCarpeta").val()});			
				$("#cajaInputCarpeta").hide();
				$("#nombreNuevaCarpeta").val("");
			}
			else{
				alert("El nombre que has elegido tiene caracteres no permitidos");
				$("#nombreNuevaCarpeta").val("");
			}
		}
		else{
			alert("Pon un nombre a la carpeta");
		}
	});
}

function nombreCarpetaValido(fname){
  return rg1.test(fname) && !rg2.test(fname) && !rg3.test(fname);
}

/**Dropzone para la subida de ficheros*/
function dropzoneFichero(){
	$("#cajaInputSubeFichero").hide();
	Dropzone.autoDiscover = false;
	$("#formFile").hide();
	//Incializo el dropzone asociado al formulario
	myDropzone = new Dropzone("form#formFile", {
		paramName: "file", // The name that will be used to transfer the file
		maxFilesize: 1000, // MB
		url: "/",
		//Se mandan los datos segun se ha subido el fichero
		autoProcessQueue: false,
		//Mostrar el link de eliminar fichero
		addRemoveLinks: true,
		uploadMultiple: true,
		//Traducciones
		dictDefaultMessage: "Suelta el archivo o haz click aquí para añadir un nuevo fichero en este directorio",
		dictRemoveFile: "Quitar fichero",
		dictFileTooBig: "El tamaño máximo es 1 GB",
		accept: function(file, done) {
			$('.dz-progress').hide();
		}
	});
}
/**Para la caja de descarga de la actualizacion*/
function cambiaColorFondo(){
	var i=0;
	setInterval(function(){
		if (i === 0){
			i = 1;
			$("#imgDescargaNuevaVersion").css("background-color","lightblue");
		}
		else{
			i = 0;
			$("#imgDescargaNuevaVersion").css("background-color","lightgoldenrodyellow");

		}
	}, 1000);
}
/**Asocia la funcion click a la imagen de descarga solo cuando
 * hay una actualizacion*/
function clickDescarga(){
	$(".imgDescargaNuevaVersion").on("click", function(event){
		event.preventDefault();
		shell.openExternal(this.alt);
		//Cerrar el programa cuando se vaya a descargar la actualizacion
		router.send("cerrarFTP");
		router.clean();
	});
}

/**Recoge cada on de los que se registran en esta vista*/
function eventosRouter(){
	//Se recibe un nuevo listado de ficheros
	router.on("listaFicheros", function(resp){
		$.unblockUI();
		$("#ruta").val(resp.ruta);
		listaFicheros = resp.ficheros;
		muestraListaFicheros();
	});
	/*Eventos de actualizacion. Si es obligatoria -> avisar y bloquear las acciones.
	 * Si no es obligatoria -> solo avisar*/
	router.on("actualizacionObligatoria", function(){
		alert("Hay una nueva versión del programa. Por favor, instala la nueva versión antes de continuar.");		
		blockActualizacion();
	});
	router.on("actualizacionOpcional", function(){
		$("#imgDescargaNuevaVersion").show();
		alert("Hay una nueva versión del programa. Si deseas instalarla, por favor pulsa en el icono que se encuentra en la cabecera.");
		cambiaColorFondo();
		clickDescarga();
	});
	//Ha habido algún error grave
	router.on("errorGrave", function(){
		var mensaje ="Ha habido algún error grave en la comunicación con " +
		"el FTP, se está cerrando el programa. Por favor, inténtalo abriendo el programa de nuevo." +
		" Disculpa las molestias";
		dialogoError(mensaje);
		notificacion(mensaje);	
	});
	//Ha habido algún error no bloqueante
	router.on("errorIntentarOtraVez", function(){
		muestraAlertaNotificacion("Ha habido algún error, inténtalo otra vez");
	});
	//Fichero guardado correctamente
	router.on("subidoCorrectamente", function(refrescarLista){
		$.unblockUI();
		notificacion('Cambios realizados correctamente');
		if(refrescarLista)
			router.send("abrirCarpeta", { "ruta": $("#ruta").val()});
	});	
	/*Para el caso de que no se haya subido correctamente un fichero*/
	router.on("ficheroDesactualizado", function(datos){
		$.unblockUI();
		dialogoFicheroDesactualizado(datos);
	});

	/*Fichero que trata de descargar ya esta abierto*/
	router.on("errorEBUSY", function(){
		muestraAlertaNotificacion("El fichero que quieres descargar está abierto en tu equipo. " +
				"Por favor cierra el fichero antes de descargarlo");
	});
	
	router.on("ficheroExisteEnDirectorio", function(){
		muestraAlertaNotificacion("El fichero que quieres mover ya existe en este directorio");
	});	
	
	router.on("carpetaExisteEnDirectorio", function(){
		muestraAlertaNotificacion("La carpeta que quieres crear ya existe en el directorio");
	});	
	
	router.on("abrirFichero",function(){
		quitaSeleccionArchivo();
	});
}
/**Muestar una alerta y una notificacion para avisos al usuario*/
function muestraAlertaNotificacion(mensaje){
	$.unblockUI();
	alert(mensaje);
	notificacion(mensaje);
}
/**Construye */
function notificacion(mensaje){
	notifier.notify({  title: 'FTP connection',
		message: mensaje,
		icon: "../css/images/logo.png", // Absolute path to Icon
		contentImage: "../css/images/logo.png",
		sound: false, // true | false.
		wait: false, // Wait for User Action against Notification
	}, function(){} );
}
/**Con cada peticion de ficheros al ftp, se reacarga el listado de ficheros mostrados por pantalla*/
function muestraListaFicheros(){
	var html = "";
	if(ordenacion === "asc")
		listaFicheros.sort(ordenaAsc);
	else
		listaFicheros.sort(ordenaDesc);
	$.each(listaFicheros, function(key, value){
		var modeloFichero= $(this)[0];
		//Clases para los ficheros y carpetas
		var clases = " fileClick ";

		if(modeloFichero.tipo === "file"){
			clases +=" esFichero ";
		}			
		else{
			clases +=" esCarpeta ";
		}
		var nuevoFichero ="<div class='cajaFichero'><div id='"+modeloFichero.tipo+"||"+modeloFichero.nombre+"||"+modeloFichero.ruta+"||"+modeloFichero.fecha+"' title='"+modeloFichero.nombre+ " " +modeloFichero.fechaVisual+"' class='"+clases+"'>";
		if(modeloFichero.tipo === "file"){
			var  extension = (modeloFichero.nombre.substring(modeloFichero.nombre.lastIndexOf("."))).toLowerCase();
			if(extension===".pdf")
				nuevoFichero +="<img class='folder' src='../css/images/logoPdf.png'/>";
			else if(extension.includes("xls"))
				nuevoFichero +="<img class='folder' src='../css/images/logoExcel.png'/>";
			else if(extension.includes("doc"))
				nuevoFichero +="<img class='folder' src='../css/images/logoWord.png'/>";
			else if(extension.includes("ppt"))
				nuevoFichero +="<img class='folder' src='../css/images/logoPpt.png'/>";
			else if(extension.includes("txt"))
				nuevoFichero +="<img class='folder' src='../css/images/logoTxt.png'/>";
			else
				nuevoFichero +="<img class='folder' src='../css/images/file.png'/>";
		}
		else{
			nuevoFichero +="<img class='folder' src='../css/images/folder.png'/>";
		}
		if(modeloFichero.nombre.length>35)
			nuevoFichero +=modeloFichero.nombre.substring(0,35)+".....";
		else
			nuevoFichero +=modeloFichero.nombre;
		nuevoFichero +="</div></div>";
		html +=nuevoFichero;
	});
	$("#cargaFicheros").html(html);
	//Para la ruta de navegación
	generaRutaNavegacion($("#ruta").val());
	//Clicks sobre los archivos
	abreArchivo();
	//Seleccion y acciones con todos los archivos
	seleccionFichero();
	seleccionCarpeta();
}

function dialogoFicheroDesactualizado(datos){
	var fichero=datos.fichero
	
	var fechaLocal = dateFormat(new Date(datos.fechaLocal), "hammerTime");
	var fechaNube = dateFormat(new Date(fichero.fecha), "hammerTime");	
	var mensaje="Parece que el fichero que quieres descargar no se actualizó correctamente " +
	"en la nube la última vez que lo editaste, ¿Quieres subir el fichero a la nube antes de abrir o " +
	"solo descargar de la nube?<br/><br/>";
	mensaje +="<div class='izquierda'><strong>Fecha de modificación en tu ordenador:</strong><br/>"+fechaLocal+"</div>" +
	"<div class='derecha'><strong>Fecha de modificación en la nube:</strong><br/>"+fechaNube+"</div>";

	BootstrapDialog.DEFAULT_TEXTS[BootstrapDialog.TYPE_PRIMARY] = 'Información';
	var dialog =new BootstrapDialog({
		message: mensaje,
		buttons: [{
			label: 'Subir a la nube antes de abrir',
			// no title as it is optional
			cssClass: 'btn-warning',
			type: BootstrapDialog.TYPE_DEFAULT,
			action: function(dialogItself){
				var mod = new modeloFichero(fichero.nombre, upath.normalize(fichero.ruta), "file", fichero.fecha)
				router.send("subeFicheroYDescarga",{"modelo": mod, "rutaActual":$("#ruta").val()});
				;
				$(".modal-dialog").hide();
				dialogItself.close();
			}
		}, {
			label: 'Descargar de la nube y abrir',
			cssClass: 'btn-primary',
			action: function(dialogItself){
				router.send("descargaFichero", {"nombre": fichero.nombre, "ruta": fichero.ruta, "fecha":fichero.fecha});
				;
				$(".modal-dialog").hide();
				dialogItself.close();
			}
		}, {
			label: 'No hacer nada',
			action: function(dialogItself){
				;
				$(".modal-dialog").hide();
				dialogItself.close();
			}
		}]
	});
	dialog.open()
	if(dialog.realized){
		dialog.$modalBody.addClass("container-fluid");
	}

}

function dialogoError(mensaje){
	
	BootstrapDialog.DEFAULT_TEXTS[BootstrapDialog.TYPE_WARNING] = 'Información';
	BootstrapDialog.show({
		message: mensaje,
		type: BootstrapDialog.TYPE_WARNING,
		buttons: [{        	
			label: 'Entendido',
			cssClass: 'btn-warning',
			action: function(dialogItself){
				block();
				$(".modal-dialog").hide();
				dialogItself.close();
				router.send("cerrarFTP", "fuerzaCierre")
			}
		}]
	});
}

function dialogoEliminar(mensaje, textoAceptar, comando){
	BootstrapDialog.DEFAULT_TEXTS[BootstrapDialog.TYPE_DANGER] = 'Eliminar';
	BootstrapDialog.show({
		message: mensaje,
		type: BootstrapDialog.TYPE_DANGER,
		buttons: [{        	
			label: textoAceptar,
			cssClass: 'btn-danger',
			action: function(dialogItself){
				block();
				router.send(comando, {"rutaCarpeta": archivoSeleccionado[indiceRuta], "rutaActual":$("#ruta").val() });
				$(".modal-dialog").hide();
				dialogItself.close();
				quitaSeleccionArchivo();
			}
		}, {
			label: 'Cancelar',
			action: function(dialogItself){
				quitaSeleccionArchivo();
				$(".modal-dialog").hide();
				dialogItself.close();
			}
		}]
	});
}