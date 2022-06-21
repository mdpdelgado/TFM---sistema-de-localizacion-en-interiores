## 10-server-2
Se basa en el siguiente ejemplo propicionado por Maxim Van de Wynckel (https://github.com/Maximvdw/openhps-examples-2021/tree/main/10-server).
Utiliza Node.js. Funciona en conjunto con la app online.

- Es un servidor modificado para probar la parte online del sistema
- Servidor con parte offline para recoger los datos de entrenamiento para fingerprint y parte online para calcular la posición
- Algortimos de fingerprint y multilateración

### Funcionalidades añadidas
- Adaptación de las balizas utilizadas en el escenario de pruebas
- Visiualización por consola de los datos que llegan de la aplicación online
- Visualización de la posición calculada (parte online) en la consola

### Instalación y ejecución
1. Clonar el repositorio
2. Ejecutar `npm install` para instalar las dependencias
3. Ejecutar `npm start` para arrancar el servidor
