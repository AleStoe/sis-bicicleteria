
export default function POSFlowMockup() {
  return (
    <div style={{ padding: 40, fontFamily: "sans-serif" }}>
      <h1>POS NUEVO - Checkout Separado</h1>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 420px",
        gap: 24,
        marginTop: 24
      }}>
        <div style={{
          background: "#fff",
          borderRadius: 20,
          padding: 24,
          border: "1px solid #ddd"
        }}>
          <h2>🛒 Armado de venta</h2>

          <input
            placeholder="Buscar producto..."
            style={{
              width: "100%",
              marginTop: 16,
              padding: 14,
              borderRadius: 12,
              border: "1px solid #ccc"
            }}
          />

          <div style={{ marginTop: 24 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 14,
              marginBottom: 12
            }}>
              <div>
                <strong>🚲 BICICLETA THOR R29</strong>
                <div>Stock: 2</div>
              </div>

              <button>+</button>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 14
            }}>
              <div>
                <strong>🪖 CASCO TOPMEGA</strong>
                <div>Stock: 38</div>
              </div>

              <button>+</button>
            </div>
          </div>
        </div>

        <div style={{
          background: "#0f172a",
          color: "white",
          borderRadius: 20,
          padding: 24
        }}>
          <h2>📦 Carrito</h2>

          <div style={{
            marginTop: 20,
            background: "#1e293b",
            padding: 16,
            borderRadius: 14
          }}>
            <div>Cliente</div>
            <strong>Consumidor Final</strong>
          </div>

          <div style={{
            marginTop: 20,
            background: "#1e293b",
            padding: 16,
            borderRadius: 14
          }}>
            <div>Precio lista</div>
            <strong style={{ fontSize: 32 }}>$618.331</strong>
          </div>

          <button style={{
            width: "100%",
            marginTop: 24,
            padding: 20,
            borderRadius: 18,
            border: "none",
            background: "#f97316",
            color: "white",
            fontWeight: "bold",
            fontSize: 20
          }}>
            IR A COBRAR →
          </button>
        </div>
      </div>

      <div style={{
        marginTop: 40,
        background: "white",
        borderRadius: 20,
        padding: 24,
        border: "1px solid #ddd"
      }}>
        <h2>💳 Checkout separado</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gap: 24,
          marginTop: 24
        }}>
          <div>
            <div style={{
              border: "1px solid #ddd",
              borderRadius: 20,
              padding: 20
            }}>
              <div>👤 Cliente de la venta</div>
              <h2>Consumidor Final</h2>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginTop: 24
            }}>
              {[
                ["💵 Efectivo", "$556.497"],
                ["🏦 Transferencia", "$556.497"],
                ["💳 Tarjeta", "Según cuotas"],
                ["📲 MercadoPago", "$618.331"],
              ].map(([nombre, total]) => (
                <div
                  key={nombre}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 20,
                    padding: 20
                  }}
                >
                  <strong>{nombre}</strong>

                  <div style={{ marginTop: 16 }}>
                    Final: {total}
                  </div>
                </div>
              ))}
            </div>

            <button style={{
              width: "100%",
              marginTop: 24,
              padding: 22,
              borderRadius: 18,
              border: "none",
              background: "#16a34a",
              color: "white",
              fontWeight: "bold",
              fontSize: 24
            }}>
              COBRAR $556.497
            </button>
          </div>

          <aside style={{
            background: "#0f172a",
            color: "white",
            borderRadius: 20,
            padding: 24
          }}>
            <div>Precio lista</div>

            <div style={{
              fontSize: 42,
              fontWeight: "bold",
              marginTop: 8
            }}>
              $618.331
            </div>

            <div style={{
              marginTop: 24,
              background: "#14532d",
              borderRadius: 18,
              padding: 20
            }}>
              <div>Precio contado</div>

              <div style={{
                fontSize: 34,
                fontWeight: "bold",
                marginTop: 8
              }}>
                $556.497
              </div>

              <div style={{ marginTop: 12 }}>
                Descuento efectivo aplicado: 10%
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
