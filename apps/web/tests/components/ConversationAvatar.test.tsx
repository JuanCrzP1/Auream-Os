import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Avatar } from "../../src/features/conversations/components/Avatar";

// La foto de perfil de WhatsApp del contacto en la bandeja; sin foto, o si el
// enlace temporal venció, sus iniciales.

describe("Avatar de un chat", () => {
  it("con foto la muestra; si el enlace falla, vuelven las iniciales", () => {
    const { container } = render(<Avatar name="Juan Camilo" phone="573001112233" photoUrl="https://pps.whatsapp.net/v/juan.jpg" size={40} />);
    const photo = container.querySelector("img")!;
    expect(photo).toHaveAttribute("src", "https://pps.whatsapp.net/v/juan.jpg");
    fireEvent.error(photo);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("JC");
  });

  it("sin foto, las iniciales", () => {
    const { container } = render(<Avatar name="Xiomara Torres" phone="573004445566" />);
    expect([container.querySelector("img"), container.textContent]).toEqual([null, "XT"]);
  });
});
