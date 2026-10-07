import "./App.css";
import { PageviewTracker } from "./components/PageviewTracker";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { OrderFlowPage } from "./pages/OrderFlowPage";
import { EducationPage } from "./pages/EducationPage";

function App() {
  return (
    <BrowserRouter>
      <PageviewTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/order-flow" element={<OrderFlowPage />} />
        <Route path="/education" element={<EducationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
