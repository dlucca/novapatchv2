import { test, expect } from "@playwright/test";

test.describe("Tienda + PDP happy path", () => {
  test("goto tienda, navigate to PDP, add one-time, then subscribe", async ({
    page,
  }) => {
    await page.goto("/mx/tienda");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Seis parches")).toBeVisible();

    // Click Energy card to navigate to PDP
    await page.getByTestId("pcard-energy").locator("a").first().click();
    await expect(page).toHaveURL(/\/mx\/productos\/energy$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Add one-time
    await page.getByRole("button", { name: /Agregar · \$750 MXN/ }).click();
    const drawer = page.getByLabel(/Tu bolsa/);
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Energy")).toBeVisible();

    await page.keyboard.press("Escape");

    // Subscribe flow: open the freq picker, pick 30d, confirm.
    // First click expands the picker.
    await page
      .getByRole("button", { name: /Suscribirme desde \$\d+\/mes/ })
      .click();
    // Pick 30d (default selected, but click anyway to verify aria-pressed)
    await page
      .getByRole("button", { name: /^30\s*d\s*−15%/i })
      .first()
      .click();
    // Confirm — button label changed
    await page
      .getByRole("button", { name: /Suscribirme · cada 30d −15%/ })
      .click();

    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Cada 30 días · −15%")).toBeVisible();
  });
});
