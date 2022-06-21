## 12-server-1
Se basa en el siguiente ejemplo propicionado por Maxim Van de Wynckel (https://github.com/Maximvdw/openhps-examples-2021/tree/main/12-server).
Utiliza Node.js. Funciona en conjunto con la app offline y la app online.

- Servidor con parte offline para recoger los datos de entrenamiento para fingerprint y parte online para calcular la posición
- Es un servidor que cuenta con una conexión con la base de datos que guarda las posiciones de las balizas y los fingerprints
- Algortimos de fingerprint y multilateración

### Funcionalidades añadidas
- Adaptación de las balizas utilizadas en el escenario de pruebas
- Adaptación a la base de datos propia
- Guardado de la posición calculada (parte online) en un fichero csv

### Instalación y ejecución
1. Clonar el repositorio
2. Ejecutar `npm install` para instalar las dependencias
3. Arracar la base de datos MongoDB
4. Ejecutar `npm start` para arrancar el servidor