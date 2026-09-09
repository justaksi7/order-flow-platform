import { WebSocketServer } from 'ws';
import type {
    ConnectedMessage,
    SnapshotMessage
} from "@orderflow/protocol";

export const createWebSocketServer = (
    port: number,
    getSnapshotMessage: () => SnapshotMessage
): WebSocketServer => {

    if (port <= 0 || port > 65535) {
        throw new Error('Port number must be between 1 and 65535');
    }

    const webSocketServer = new WebSocketServer({ port });
    webSocketServer.on('listening', () => {
        console.log(`WebSocket server is listening on port ${port}`);
    });

    webSocketServer.on("connection", (socket) => {
        console.log("WebSocket client connected.");

        const connectedMessage: ConnectedMessage = {
            type: "CONNECTED",
            message: "Connected to Order Flow backend"
        };

        socket.send(
            JSON.stringify(connectedMessage)
        );
        const snapshotMessage = getSnapshotMessage();

        socket.send(
            JSON.stringify(snapshotMessage)
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

    return webSocketServer;
}
