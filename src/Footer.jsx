import React from "react";
import FooterLogo from "./assets/Footer.webp"


const Footer = () => {
    return(
        <footer className="flex items-center justify-center gap-2 py-4 text-xs text-[#00528d]/50">
            Developed and Maintained by the CAMP Team
            <img src={FooterLogo} alt="logo" className="w-5 h-5 object-contain"/>
        </footer>
    )
}

export default Footer