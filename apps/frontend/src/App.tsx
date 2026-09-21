import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { OrderFlowPage } from "./pages/OrderFlowPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/order-flow" element={<OrderFlowPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
