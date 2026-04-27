import { test, expect } from "@playwright/test";

test.describe("Home + cart happy path", () => {
  test("hero, selector, add to bag, persistence, clear, newsletter", async ({ page }) => {
    // Mock the waitlist endpoint
    await page.route("**/waitlist", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );

    await page.goto("/es");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Click Energy in selector (auto-rotation will pause)
    await page.getByRole("button", { name: /Mostrar parche Energy/i }).click();
    await expect(page.getByRole("button", { name: /Mostrar parche Energy/i })).toHaveAttribute("aria-pressed", "true");

    // Click Agregar on Energy product card
    await page.getByTestId("pcard-energy").getByRole("button", { name: /Agregar/i }).click();
    await expect(page.getByText("Tu bolsa")).toBeVisible();
    await expect(page.getByText("Energy")).toBeVisible();

    // Close drawer (Escape)
    await page.keyboard.press("Escape");

    // Reopen via nav cart button
    await page.getByRole("button", { name: /Bolsa, 1 parche/ }).click();
    await expect(page.getByText("Energy")).toBeVisible();

    // Reload and confirm persistence
    await page.reload();
    await page.getByRole("button", { name: /Bolsa, 1 parche/ }).click();
    await expect(page.getByText("Energy")).toBeVisible();

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
