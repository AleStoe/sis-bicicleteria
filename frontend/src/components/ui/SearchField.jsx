import { Search } from "lucide-react";

export default function SearchField({
  value,
  onChange,
  onSearch,
  placeholder,
  style,
  inputStyle,
  inputRef,
  disabled = false,
  ariaLabel = "Buscar",
}) {
  function confirmar(input) {
    onSearch?.(value);
    input?.blur();
  }

  return (
    <div style={{ ...baseStyles.wrap, ...style }}>
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          confirmar(event.currentTarget);
        }}
        placeholder={placeholder}
        style={{ ...baseStyles.input, ...inputStyle, paddingRight: 54 }}
        aria-label={ariaLabel}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={(event) => {
          const input = event.currentTarget.parentElement?.querySelector("input");
          confirmar(input);
        }}
        style={baseStyles.button}
        title={ariaLabel}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <Search size={19} />
      </button>
    </div>
  );
}

const baseStyles = {
  wrap: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    borderRadius: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  },
  button: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 46,
    minHeight: 40,
    display: "grid",
    placeItems: "center",
    border: 0,
    borderLeft: "1px solid #dbe3ee",
    borderRadius: 0,
    background: "rgba(248, 250, 252, 0.96)",
    color: "#0f172a",
    cursor: "pointer",
    padding: 0,
  },
};
