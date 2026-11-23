const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
const dropdowns = document.querySelectorAll(".nav-dropdown");

if (menuToggle && navigation) {
    menuToggle.addEventListener("click", () => {
        const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
        menuToggle.setAttribute("aria-expanded", String(!isExpanded));
        menuToggle.setAttribute(
            "aria-label",
            isExpanded ? "Open navigation menu" : "Close navigation menu",
        );
        navigation.classList.toggle("is-open", !isExpanded);
    });

    document.addEventListener("click", (event) => {
        if (
            !navigation.contains(event.target) &&
            !menuToggle.contains(event.target)
        ) {
            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Open navigation menu");
            navigation.classList.remove("is-open");
        }
    });
}

dropdowns.forEach((dropdown) => {
    dropdown.addEventListener("toggle", () => {
        if (!dropdown.open) {
            return;
        }

        dropdowns.forEach((otherDropdown) => {
            if (otherDropdown !== dropdown) {
                otherDropdown.open = false;
            }
        });
    });
});
