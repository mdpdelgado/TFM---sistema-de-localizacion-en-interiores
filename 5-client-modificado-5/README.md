## 5-client-modificado-5
Se basa en el siguiente ejemplo propicionado por Maxim Van de Wynckel (https://github.com/Maximvdw/openhps-examples-2021/tree/main/5-client).
Utiliza Node.js. Funciona en conjunto con 4-server-modificado-3.

- Es un cliente básico que usa OpenHPS
- Envía los datos para que el servidor calcule la posición del terminal

### Funcionalidades añadidas
- Lee los datos de posición simulados de un fichero csv para envíarlos al servidor
- Recibe la posición calculada por el servidor y la muestra por consola

### Instalación y ejecución
1. Clonar el repositorio
2. Ejecutar `npm install` para instalar las dependencias
3. Ejecutar `npm start` para arrancar el cliente
