import { test, expect } from "@playwright/test";

test.describe("Home + cart happy path", () => {
  test("hero, selector, add to bag, persistence, clear, newsletter", async ({ page }) => {
    // Mock the waitlist endpoint
    await page.route("**/waitlist", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );

    await page.goto("/mx");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Click Glow in selector to lock auto-rotation on Glow
    await page.getByRole("button", { name: /Mostrar parche Glow/i }).click();
    await expect(page.getByRole("button", { name: /Mostrar parche Glow/i })).toHaveAttribute("aria-pressed", "true");

    // Hero primary CTA adds the currently selected product (Glow) to the cart
    await page.getByRole("button", { name: /Agregar Glow · \$750/i }).click();
    const drawer = page.getByLabel(/Tu bolsa/);
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Glow")).toBeVisible();

    // Close drawer (Escape)
    await page.keyboard.press("Escape");

    // Reopen via nav cart button
    await page.getByRole("button", { name: /Bolsa, 1 parche/ }).click();
    await expect(drawer.getByText("Glow")).toBeVisible();

    // Reload and confirm persistence
    await page.reload();
    await page.getByRole("button", { name: /Bolsa, 1 parche/ }).click();
    await expect(drawer.getByText("Glow")).toBeVisible();

    // Clear cart
    await page.getByRole("button", { name: "Vaciar bolsa" }).click();
    await expect(page.getByText("Tu bolsa está vacía")).toBeVisible();

    // Close drawer + scroll to footer + submit newsletter
    await page.keyboard.press("Escape");
    await page.getByPlaceholder("tu@correo.com").fill("test-home@example.com");
    await page.getByRole("button", { name: "Suscribirse" }).click();
    await expect(page.getByText(/Te suscribimos/)).toBeVisible();
  });
});
