/**
 * http://usejsdoc.org/
 */
var usuario = "";
var password = "";
var url = "";
var puerto = "";
function modeloLogin(){
}
modeloLogin.prototype.setUsuario = function (usuario){
	this.usuario = usuario;
};
modeloLogin.prototype.setPassword= function (password){
	this.password = password;
};
modeloLogin.prototype.setUrl= function (url){
	this.url = url;
};
modeloLogin.prototype.setPuerto= function (puerto){
	this.puerto = puerto;
};
module.exports = modeloLogin;