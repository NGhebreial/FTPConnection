/**
 * http://usejsdoc.org/
 */

const dateFormat = require('dateformat');
dateFormat.masks.hammerTime = "dd-mm-yyyy, HH-MM-ss";
var nombre;
var ruta;
var tipo;
var fechaVisual;
var fecha;
var size;
/**Nombre, ruta, tipo, fecha, size*/
function modeloFichero(nombre, ruta, tipo, time, fecha, size){
	fechaVisual=new Date(time);
	this.nombre = nombre;
	this.ruta = ruta;
	this.tipo = tipo;
	this.fechaVisual = dateFormat(fechaVisual, "hammerTime");
	this.fecha = fecha;
	this.size = size;
}

module.exports = modeloFichero;