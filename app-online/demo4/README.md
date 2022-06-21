## App online
Se basa en la aplicación de Maxim Van de Wynckel (https://github.com/OpenHPS/openhps-react-native/tree/master/demo/demo_fingerprinting) usada en el proyecto IPIN 2021: Indoor Positioning Using the OpenHPS Framework (https://openhps.org/posts/2021/12/01/).
Funciona en conjunto con 10-server-1, 12-server-1 y 12-server-2.

- Aplicación online para enviar datos desde el terminal al servidor para que se pueda calcular la posición del terminal móvil. 

### Funcionalidades añadidas
- Adaptación de las balizas utilizadas en el escenario de pruebas
- Cambio del SocketClientSink a online para que se conecte con la parte online del servidor
- Cambio en el nodo que envía los datos de la app al servidor (se usa FrameMergeNode)
- Eliminación del envío de la posición desde la app, para dejar que el servidor se encargue de calcularla
- Adaptación al mapa de pruebas: cambio del mapa, cambio de las dimensiones del mapa y cambio de los puntos de prueba representados.

## Requisitos
- Android SDK
- Android build-tools 32.0.0 (Android/build.gradle)

### Instalación y ejecución
1. Clonar el repositorio
2. Ejecutar `npm install` para instalar las dependencias
3. Ejecutar `npm run build:bundle-threads-android` para crear los bundles
4. Ejecutar `npm run android` para lanzar la aplicación en el terminal móvil