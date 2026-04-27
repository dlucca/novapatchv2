// ═══════════════════════════════════════════════════════════
// PlanBuilderMobile — Mobile-first version of the plan builder.
// Single fluid column, breathing cards, floating bottom summary bar.
// ═══════════════════════════════════════════════════════════
const { useState: useStateM, useEffect: useEffectM } = React;

window.PlanBuilderMobile = function PlanBuilderMobile({ onAdd }) {
  const [plan, setPlan] = useStateM({});
  const [drawerOpen, setDrawerOpen] = useStateM(false);

  const togglePlan = (slug) => {
    setPlan((p) => {
      const ex = p[slug];
      if (ex && ex.active) return { ...p, [slug]: { ...ex, active: false } };
      return { ...p, [slug]: { active: true, freq: 30 } };
    });
  };
  const setFreq = (slug, freq) => {
    setPlan((p) => ({ ...p, [slug]: { active: true, freq } }));
  };

  const items = NOVA_PRODUCTS
    .map((p) => ({ p, ...(plan[p.slug] || {}) }))
    .filter((it) => it.active);
  const monthly = items.reduce((acc, it) => {
    const fp = FREQ_PLANS.find((f) => f.days === it.freq);
    const perBox = RETAIL_PRICE * (1 - fp.discount);
    return acc + perBox / (it.freq / 30);
  }, 0);
  const fullMonthly = items.reduce((acc, it) => acc + RETAIL_PRICE / (it.freq / 30), 0);
  const saved = fullMonthly - monthly;

  const handleSubscribe = () => {
    items.forEach((it) => {
      const fp = FREQ_PLANS.find((f) => f.days === it.freq);
      const perBox = Math.round(RETAIL_PRICE * (1 - fp.discount));
      onAdd({ ...it.p }, perBox);
    });
  };

  return (
    <>
      <section style={{ background: "#FAF7F2", padding: "80px 24px 200px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* Discount legend — explicativo */}
          <div style={{
            background: "#fff",
            border: "1px solid rgba(13,27,53,0.06)",
            borderRadius: 22,
            padding: "22px 22px 18px",
            marginBottom: 56,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 18,
            }}>
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: "0.16em",
                textTransform: "uppercase", color: "#1CB1BC",
              }}>Cómo funciona</span>
              <span style={{ flex: 1, height: 1, background: "rgba(13,27,53,0.08)" }}/>
            </div>

            <div style={{
              fontSize: 14.5, lineHeight: 1.55, color: "rgba(13,27,53,0.75)",
              marginBottom: 20, maxWidth: 520,
            }}>
              Mientras más seguido recibas tus parches, mayor es tu descuento. Elige la frecuencia que mejor se adapte a tu rutina.
            </div>

            {/* Visual scale: arrow showing relationship */}
            <div style={{ position: "relative", padding: "0 4px" }}>
              {/* Track */}
              <div style={{
                position: "absolute", left: 12, right: 12, top: 18,
                height: 3, borderRadius: 9999,
                background: "linear-gradient(90deg, #1CB1BC 0%, #83B5F4 50%, #F2C24A 100%)",
                opacity: 0.35,
              }}/>
              {/* Dots and tiers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, position: "relative" }}>
                {[
                  { f: FREQ_PLANS[0], color: "#1CB1BC", label: "Rutina diaria",      sub: "para quien lo usa todos los días" },
                  { f: FREQ_PLANS[1], color: "#83B5F4", label: "Equilibrio",         sub: "uso frecuente, no a diario" },
                  { f: FREQ_PLANS[2], color: "#F2C24A", label: "Para probar",        sub: "ideal si recién empiezas" },
                ].map((t) => (
                  <div key={t.f.days} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                    {/* dot anchored to track */}
                    <span style={{
                      width: 14, height: 14, borderRadius: 9999,
                      background: t.color,
                      boxShadow: `0 0 0 5px ${t.color}26, 0 0 0 1px #fff inset`,
                      marginTop: 11,
                      position: "relative", zIndex: 1,
                    }}/>
                    {/* days */}
                    <div style={{
                      fontFamily: "Outfit", fontWeight: 800, fontSize: 13,
                      color: "rgba(13,27,53,0.6)", marginTop: 12, letterSpacing: "0.03em",
                    }}>
                      Cada {t.f.days} días
                    </div>
                    {/* discount big */}
                    <div style={{
                      fontFamily: "Outfit", fontWeight: 900, fontSize: 30,
                      color: "#0D1B35", letterSpacing: "-0.04em", lineHeight: 1, marginTop: 4,
                    }}>
                      −{Math.round(t.f.discount * 100)}<span style={{ fontSize: 16, color: "rgba(13,27,53,0.5)", fontWeight: 700 }}>%</span>
                    </div>
                    {/* description */}
                    <div style={{
                      fontFamily: "Outfit", fontWeight: 700, fontSize: 13,
                      color: t.color, marginTop: 8, letterSpacing: "-0.005em",
                    }}>
                      {t.label}
                    </div>
                    <div style={{
                      fontSize: 11.5, color: "rgba(13,27,53,0.55)",
                      marginTop: 3, lineHeight: 1.35, maxWidth: 130,
                    }}>
                      {t.sub}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, color: "rgba(13,27,53,0.55)" }}>
            <span style={{
              width: 24, height: 24, borderRadius: 9999,
              background: "#0D1B35", color: "#fff",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, fontFamily: "Outfit",
            }}>1</span>
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.02em" }}>Activa los parches que quieres</span>
          </div>

          {/* Cards stack */}
          <div style={{ display: "grid", gap: 16, marginBottom: 12 }}>
            {NOVA_PRODUCTS.map((p) => (
              <PlanCardMobile
                key={p.slug}
                p={p}
                state={plan[p.slug] || { active: false, freq: 30 }}
                onToggle={() => togglePlan(p.slug)}
                onFreqChange={(f) => setFreq(p.slug, f)}
              />
            ))}
          </div>

          {/* Helper at bottom */}
          {items.length === 0 && (
            <div style={{
              marginTop: 32, padding: "20px 24px",
              background: "rgba(28,177,188,0.1)",
              border: "1px dashed rgba(28,177,188,0.4)",
              borderRadius: 16,
              fontSize: 14, color: "rgba(13,27,53,0.7)",
              textAlign: "center", lineHeight: 1.55,
            }}>
              <strong style={{ color: "#0D1B35", fontWeight: 700 }}>Empieza por uno.</strong> Puedes agregar, pausar o quitar parches cuando quieras.
            </div>
          )}
        </div>
      </section>

      {/* Floating bottom summary */}
      <PlanBottomBar
        items={items}
        monthly={monthly}
        saved={saved}
        open={drawerOpen}
        onToggle={() => setDrawerOpen((v) => !v)}
        onSubscribe={handleSubscribe}
      />
    </>
  );
};

function PlanCardMobile({ p, state, onToggle, onFreqChange }) {
  const active = state.active;
  const fp = FREQ_PLANS.find((f) => f.days === state.freq) || FREQ_PLANS[0];
  const perBox = Math.round(RETAIL_PRICE * (1 - fp.discount));

  return (
    <article style={{
      background: active ? p.bg : "#fff",
      border: active ? `2px solid ${p.color}` : "2px solid rgba(13,27,53,0.06)",
      borderRadius: 24,
      overflow: "hidden",
      transition: "all 280ms cubic-bezier(0.22,1,0.36,1)",
      boxShadow: active ? `0 16px 36px ${p.color}26` : "0 4px 14px rgba(13,27,53,0.04)",
    }}>
      {/* Top row: image + name + price + toggle */}
      <button
        onClick={onToggle}
        aria-pressed={active}
        style={{
          width: "100%", textAlign: "left",
          padding: "20px 22px",
          display: "grid",
          gridTemplateColumns: "76px 1fr auto",
          alignItems: "center", gap: 18,
          background: "transparent",
          border: "none", cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <div style={{
          width: 76, height: 76,
          borderRadius: 16,
          background: active ? "rgba(255,255,255,0.6)" : p.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          transition: "all 250ms",
        }}>
          <img src={p.image} alt={p.name} style={{
            height: 70, width: 50, objectFit: "contain",
            filter: active ? `drop-shadow(0 6px 10px ${p.color}55)` : "none",
            transition: "filter 250ms",
          }}/>
        </div>

        <div>
          <div style={{
            fontFamily: "Outfit", fontWeight: 900, fontSize: 22,
            letterSpacing: "-0.02em", color: p.ink, lineHeight: 1.05,
          }}>{p.name}</div>
          <div style={{
            fontSize: 13.5, color: "rgba(13,27,53,0.6)",
            marginTop: 4, lineHeight: 1.35,
          }}>{p.tagline}</div>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 6,
            marginTop: 8,
          }}>
            <span style={{
              fontFamily: "Outfit", fontWeight: 800, fontSize: 15,
              color: active ? p.ink : "rgba(13,27,53,0.7)",
              letterSpacing: "-0.01em",
            }}>${active ? perBox : RETAIL_PRICE}</span>
            <span style={{ fontSize: 11.5, color: "rgba(13,27,53,0.5)" }}>MXN / caja</span>
            {active && (
              <span style={{
                marginLeft: 4,
                background: p.color, color: "#fff",
                padding: "2px 9px", borderRadius: 9999,
                fontFamily: "Outfit", fontWeight: 800, fontSize: 10.5, letterSpacing: "0.02em",
              }}>−{Math.round(fp.discount * 100)}%</span>
            )}
          </div>
        </div>

        <ToggleM active={active} color={p.color}/>
      </button>

      {/* Frequency picker — only when active, expands smoothly */}
      <div style={{
        maxHeight: active ? 200 : 0,
        overflow: "hidden",
        transition: "max-height 350ms cubic-bezier(0.22,1,0.36,1)",
      }}>
        <div style={{
          padding: "0 22px 22px",
          borderTop: `1px dashed ${p.color}55`,
          paddingTop: 18, marginTop: 4,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(13,27,53,0.55)",
            marginBottom: 12,
          }}>¿Cada cuánto te llega?</div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
          }}>
            {FREQ_PLANS.map((f) => {
              const sel = state.freq === f.days;
              return (
                <button
                  key={f.days}
                  onClick={(e) => { e.stopPropagation(); onFreqChange(f.days); }}
                  style={{
                    padding: "14px 10px",
                    background: sel ? p.ink : "rgba(255,255,255,0.6)",
                    color: sel ? "#fff" : "rgba(13,27,53,0.75)",
                    border: sel ? `2px solid ${p.ink}` : "2px solid rgba(13,27,53,0.08)",
                    borderRadius: 14, cursor: "pointer",
                    fontFamily: "Outfit",
                    transition: "all 180ms",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em", lineHeight: 1.05 }}>
                    {f.days}<span style={{ fontSize: 11, fontWeight: 600, opacity: 0.7 }}>d</span>
                  </div>
                  <div style={{
                    fontSize: 11, marginTop: 4, fontWeight: 700,
                    color: sel ? p.color : p.color,
                    opacity: sel ? 1 : 0.85,
                  }}>−{Math.round(f.discount * 100)}%</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

function ToggleM({ active, color }) {
  return (
    <span aria-hidden="true" style={{
      position: "relative",
      width: 50, height: 30, borderRadius: 9999,
      background: active ? color : "rgba(13,27,53,0.14)",
      transition: "background 200ms",
      flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 3, left: active ? 23 : 3,
        width: 24, height: 24, borderRadius: 9999,
        background: "#fff",
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
        transition: "left 220ms cubic-bezier(0.22,1,0.36,1)",
      }}/>
    </span>
  );
}

function PlanBottomBar({ items, monthly, saved, open, onToggle, onSubscribe }) {
  const empty = items.length === 0;

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0,
      zIndex: 50,
      display: "flex", justifyContent: "center",
      pointerEvents: "none",
      padding: 16,
    }}>
      <div style={{
        pointerEvents: "auto",
        width: "100%", maxWidth: 560,
        background: "#0D1B35",
        color: "#fff",
        borderRadius: 24,
        boxShadow: "0 24px 64px rgba(13,27,53,0.32)",
        overflow: "hidden",
        transition: "all 320ms cubic-bezier(0.22,1,0.36,1)",
      }}>
        {/* Expanded breakdown */}
        <div style={{
          maxHeight: open && !empty ? 360 : 0,
          overflow: "hidden",
          transition: "max-height 350ms cubic-bezier(0.22,1,0.36,1)",
        }}>
          <div style={{ padding: "22px 22px 4px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", marginBottom: 14 }}>
              Tu plan mensual
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "grid", gap: 8, maxHeight: 200, overflowY: "auto" }}>
              {items.map((it) => {
                const fp = FREQ_PLANS.find((f) => f.days === it.freq);
                const perBox = Math.round(RETAIL_PRICE * (1 - fp.discount));
                return (
                  <li key={it.p.slug} style={{
                    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center",
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 12,
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: 9999, background: it.p.color,
                      boxShadow: `0 0 0 3px ${it.p.color}33`,
                    }}/>
                    <div>
                      <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: 14 }}>{it.p.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1 }}>cada {it.freq} días · −{Math.round(fp.discount * 100)}%</div>
                    </div>
                    <span style={{ fontFamily: "Outfit", fontWeight: 800, fontSize: 14 }}>${perBox}</span>
                  </li>
                );
              })}
            </ul>
            {saved > 0 && (
              <div style={{
                display: "flex", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 12,
                background: "rgba(28,177,188,0.14)",
                border: "1px solid rgba(28,177,188,0.28)",
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 12.5, color: "#9DE1E8" }}>Ahorras al mes</span>
                <span style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: 14, color: "#1CB1BC" }}>
                  ${Math.round(saved)} MXN
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Always-visible footer row */}
        <div style={{
          padding: "16px 18px 16px 22px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: 14,
          borderTop: open && !empty ? "1px solid rgba(255,255,255,0.08)" : "none",
        }}>
          <button onClick={onToggle} disabled={empty} style={{
            background: "transparent", border: "none",
            color: "#fff", cursor: empty ? "default" : "pointer",
            padding: 0, textAlign: "left",
            display: "flex", alignItems: "center", gap: 12,
            fontFamily: "inherit",
          }}>
            <div>
              <div style={{
                fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)", fontWeight: 700,
                marginBottom: 2,
              }}>
                {empty ? "Tu plan" : `${items.length} ${items.length === 1 ? "parche activo" : "parches activos"}`}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "Outfit", fontWeight: 900, fontSize: 26, letterSpacing: "-0.03em", lineHeight: 1 }}>
                  ${empty ? 0 : Math.round(monthly)}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>MXN / mes</span>
                {!empty && (
                  <span aria-hidden="true" style={{
                    marginLeft: 6, display: "inline-flex",
                    transform: open ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 250ms",
                    color: "rgba(255,255,255,0.6)",
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15"/>
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </button>

          <button onClick={onSubscribe} disabled={empty} style={{
            padding: "14px 22px",
            background: empty ? "rgba(255,255,255,0.1)" : "#E8503A",
            color: empty ? "rgba(255,255,255,0.4)" : "#fff",
            border: "none", borderRadius: 9999,
            fontFamily: "Outfit", fontWeight: 800, fontSize: 14.5,
            cursor: empty ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
            display: "inline-flex", alignItems: "center", gap: 8,
            boxShadow: empty ? "none" : "0 8px 22px rgba(232,80,58,0.4)",
            transition: "all 200ms",
            whiteSpace: "nowrap",
          }}>
            {empty ? "Activa parches" : "Suscribirme"}
            {!empty && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
