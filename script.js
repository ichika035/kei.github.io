const text = document.getElementById("hoverText");

// カーソルが乗った時
text.addEventListener("mouseenter", () => {
    text.classList.add("hover");
});

// カーソルが離れた時
text.addEventListener("mouseleave", () => {
    text.classList.remove("hover");
});
