import { API_BASE_URL } from "../../config/appConfig";

function getImageUrl(url) {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_BASE_URL}${url}`;
}

export default function ProductImage({ url, size = 58 }) {
  const boxStyle = {
    ...styles.box,
    width: size,
    height: size,
  };

  if (!url) {
    return (
      <div style={boxStyle}>
        <span style={styles.placeholderIcon}>🚲</span>
        <small style={styles.placeholderText}>Sin imagen</small>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <img src={getImageUrl(url)} alt="Producto" style={styles.image} />
    </div>
  );
}

const styles = {
  box: {
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    padding: 6,
    boxSizing: "border-box",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
  },
  placeholderIcon: {
    fontSize: 24,
    lineHeight: 1,
  },
  placeholderText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 800,
    textAlign: "center",
  },
};
