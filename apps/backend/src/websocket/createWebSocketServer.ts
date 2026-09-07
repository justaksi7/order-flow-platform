import { WebSocketServer } from 'ws';

export const createWebSocketServer = (port: number): WebSocketServer => {
    if (port <= 0 || port > 65535) {
        throw new Error('Port number must be between 1 and 65535');
    }

    const webSocketServer = new WebSocketServer({ port });
    webSocketServer.on('listening', () => {
        console.log(`WebSocket server is listening on port ${port}`);
    });

    webSocketServer.on("connection", (socket) => {
        console.log("WebSocket client connected.");

        webSocketServer.on("connection", (socket) => {
            console.log("WebSocket client connected.");

            socket.send(
                JSON.stringify({
                    type: "CONNECTED",
                    message: "Connected to Order Flow backend"
                })
            );

            socket.on("message", (data) => {
                const message = data.toString();

                console.log(
                    "Message received from client:",
                    message
                );
            });

            socket.on("close", () => {
                console.log("WebSocket client disconnected.");
            });

            socket.on("error", (error) => {
                console.error(
                    "WebSocket client error:",
                    error
                );
            });
        });
    });

    return webSocketServer;
}
