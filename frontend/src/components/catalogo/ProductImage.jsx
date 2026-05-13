export default function ProductImage({ url }) {
  if (!url) {
    return <div style={styles.placeholder}>Sin imagen</div>;
  }

  return <img src={url} alt="Producto" style={styles.image} />;
}

const styles = {
  image: {
    width: "58px",
    height: "58px",
    objectFit: "cover",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
  },
  placeholder: {
    width: "58px",
    height: "58px",
    borderRadius: "12px",
    border: "1px dashed #d0d5dd",
    display: "grid",
    placeItems: "center",
    color: "#667085",
    fontSize: "11px",
    textAlign: "center",
    background: "#f9fafb",
  },
};