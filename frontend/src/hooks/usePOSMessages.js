import { useRef, useState } from "react";

export default function usePOSMessages() {
  const timeoutRef = useRef(null);
  const [mensajePOS, setMensajePOS] = useState("");

  function mostrarMensajePOS(texto) {
    setMensajePOS(texto);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setMensajePOS("");
      timeoutRef.current = null;
    }, 2500);
  }

  return {
    mensajePOS,
    mostrarMensajePOS,
  };
}
