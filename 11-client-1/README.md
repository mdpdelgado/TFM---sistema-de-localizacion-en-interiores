## 11-client-1
Se basa en el siguiente ejemplo propicionado por Maxim Van de Wynckel (https://github.com/Maximvdw/openhps-examples-2021/tree/main/11-client)
Utiliza Node.js. Funciona en conjunto con 10-server-1.

- Es un cliente que usa OpenHPS
- Envía los datos para que el servidor calcule la posición del terminal

### Funcionalidades añadidas
- Posiciones simuladas del csv adaptadas a las balizas del escenario
- Cambio en la lectura de csv adaptado a las balizas del escenario

### Instalación y ejecución
1. Clonar el repositorio
2. Ejecutar `npm install` para instalar las dependencias
3. Ejecutar `npm start` para arrancar el cliente