"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/categorize";
import { rollingWindow, todayKey } from "@/lib/dates";

// Fallback dinner ideas, keyed by weekday name (used when the AI call fails).
const FALLBACK_SUGGESTIONS = {
  Monday: { meal: "Tacos", note: "Easy weeknight starter" },
  Tuesday: { meal: "Crispy chicken", note: "Quick and crowd-pleasing" },
  Wednesday: { meal: "Mac n cheese", note: "Midweek comfort food" },
  Thursday: { meal: "Pasta & sausage", note: "Simple and satisfying" },
  Friday: { meal: "Grilled chicken & salad", note: "Light finish to the week" },
  Saturday: { meal: "Pork pasta", note: "Weekend cook, family favorite" },
  Sunday: { meal: "Shrimp risotto", note: "Sunday special" },
};

export default function MealPlanner() {
  const [mealList, setMealList] = useState([]);
  const [meals, setMeals] = useState({}); // keyed by date: { "2026-06-17": "Tacos" }
  const [notes, setNotes] = useState({}); // keyed by date
  const [items, setItems] = useState([]);
  const [dbOk, setDbOk] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [editingKey, setEditingKey] = useState(null); // which date is being edited
  const [inputVal, setInputVal] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeal, setAiMeal] = useState(null);
  const [tab, setTab] = useState("plan"); // plan | shopping | menu | history
  const [calendarEvents, setCalendarEvents] = useState({}); // keyed by date

  // The rolling window: today through today+6, computed once per mount.
  const days = useMemo(() => rollingWindow(7), []);
  const windowKeys = useMemo(() => days.map((d) => d.key), [days]);

  // Recipe importer state
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeInput, setRecipeInput] = useState("");
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState("");
  const [recipeParsed, setRecipeParsed] = useState(null); // {name, ingredients}
  const [recipeSaved, setRecipeSaved] = useState(false);
  const [newIngredient, setNewIngredient] = useState("");

  const mealSyncTimeout = useRef(null);

  const loadMealList = () =>
    fetch("/api/meal-list")
      .then((r) => r.json())
      .then((data) => setMealList(data.meals ?? []))
      .catch(() => {});

  useEffect(() => {
    loadMealList();
    fetch("/api/calendar")
      .then((r) => r.json())
      .then((data) => setCalendarEvents(data))
      .catch(() => {});
  }, []);

  // Poll the meal plan while on the plan, menu, or history tab
  useEffect(() => {
    if (tab !== "plan" && tab !== "menu" && tab !== "history") return;
    const sync = () =>
      fetch("/api/meals")
        .then((r) => r.json())
        .then((data) => {
          if (data.meals) setMeals(data.meals);
          if (data.notes) setNotes(data.notes);
        })
        .catch(() => {});
    sync();
    const interval = setInterval(sync, tab === "menu" ? 20000 : 5000);
    return () => clearInterval(interval);
  }, [tab]);

  const syncMeals = (nextMeals, nextNotes) => {
    if (mealSyncTimeout.current) clearTimeout(mealSyncTimeout.current);
    mealSyncTimeout.current = setTimeout(() => {
      fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // windowKeys lets the server reconcile the shopping list against the
        // rolling today→+6 window without doing its own timezone math.
        body: JSON.stringify({ meals: nextMeals, notes: nextNotes, windowKeys }),
      }).catch(() => {});
    }, 500);
  };

  // Poll the shared shopping list while on the shopping tab
  useEffect(() => {
    if (tab !== "shopping") return;
    const sync = () =>
      fetch("/api/shopping")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.items)) setItems(data.items);
          if (typeof data.dbOk === "boolean") setDbOk(data.dbOk);
        })
        .catch(() => {});
    sync();
    const interval = setInterval(sync, 3000);
    return () => clearInterval(interval);
  }, [tab]);

  const shoppingAction = (payload) =>
    fetch("/api/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) setItems(data.items);
        if (typeof data.dbOk === "boolean") setDbOk(data.dbOk);
      })
      .catch(() => {});

  const toggleItem = (id) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
    shoppingAction({ action: "toggle", id });
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    shoppingAction({ action: "remove", id });
  };

  const addCustomItem = () => {
    const name = newItem.trim();
    if (!name) return;
    setNewItem("");
    shoppingAction({ action: "add", names: [name] });
  };

  const startEdit = (key) => {
    setEditingKey(key);
    setInputVal(meals[key] || "");
    setShowSuggestions(false);
    setBrowsing(false);
    setAiMeal(null);
  };

  const saveEdit = (key) => {
    const nextMeals = { ...meals, [key]: inputVal };
    if (!inputVal) delete nextMeals[key]; // don't persist empty days
    setMeals(nextMeals);
    setEditingKey(null);
    setShowSuggestions(false);
    setBrowsing(false);
    setAiMeal(null);
    syncMeals(nextMeals, notes);
  };

  const pickSuggestion = (s) => {
    setInputVal(s);
    setShowSuggestions(false);
    setBrowsing(false);
  };

  const askAI = async (key, weekday) => {
    setAiLoading(true);
    setAiMeal(null);
    const dayCalEvents = calendarEvents[key] || [];
    const calendarNote = dayCalEvents.length
      ? dayCalEvents.map((e) => `${e.title} (${e.time})`).join(", ")
      : "";
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: weekday,
          calendarNote,
          // only avoid repeating meals already in the rolling window
          alreadyPlanned: windowKeys.map((k) => meals[k]).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.meal) {
        setAiMeal(data);
        setInputVal(data.meal);
      } else {
        throw new Error("no suggestion");
      }
    } catch {
      const fb = FALLBACK_SUGGESTIONS[weekday] || FALLBACK_SUGGESTIONS.Monday;
      setAiMeal(fb);
      setInputVal(fb.meal);
    }
    setAiLoading(false);
  };

  // ---- Recipe importer ----
  const parseRecipe = async () => {
    const input = recipeInput.trim();
    if (!input) return;
    setRecipeLoading(true);
    setRecipeError("");
    setRecipeParsed(null);
    setRecipeSaved(false);
    const isLink = /^https?:\/\/\S+$/i.test(input);
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isLink ? { url: input } : { text: input }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Couldn't read that recipe");
      setRecipeParsed({ name: data.name, ingredients: data.ingredients });
    } catch (e) {
      setRecipeError(e.message || "Couldn't read that recipe");
    }
    setRecipeLoading(false);
  };

  const saveRecipe = async () => {
    if (!recipeParsed?.name) return;
    setRecipeLoading(true);
    setRecipeError("");
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ save: recipeParsed }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Couldn't save");
      setRecipeSaved(true);
      loadMealList();
    } catch (e) {
      setRecipeError(e.message || "Couldn't save");
    }
    setRecipeLoading(false);
  };

  const closeRecipe = () => {
    setRecipeOpen(false);
    setRecipeInput("");
    setRecipeParsed(null);
    setRecipeError("");
    setRecipeSaved(false);
    setNewIngredient("");
  };

  const dayEvents = (key) => calendarEvents[key] || [];
  const hasAlert = (key) => dayEvents(key).some((e) => e.isOut);

  // Past meals (before today) that were actually planned, newest first.
  const historyEntries = useMemo(() => {
    const today = todayKey();
    return Object.keys(meals)
      .filter((k) => k < today && meals[k])
      .sort((a, b) => (a < b ? 1 : -1));
  }, [meals]);

  const mealNames = mealList.map((m) => m.name);
  const filteredSuggestions = browsing
    ? mealNames.filter((s) => s !== inputVal)
    : mealNames
        .filter(
          (s) => inputVal.length > 0 && s.toLowerCase().includes(inputVal.toLowerCase()) && s !== inputVal
        )
        .slice(0, 6);

  const checkedCount = items.filter((i) => i.checked).length;
  const itemsByCategory = useMemo(() => {
    const groups = {};
    for (const cat of CATEGORIES) groups[cat] = [];
    for (const item of items) {
      (groups[item.category] || groups.Other).push(item);
    }
    for (const cat of CATEGORIES) {
      groups[cat].sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1));
    }
    return groups;
  }, [items]);

  const btnStyle = (active) => ({
    background: active ? "#c8a96e" : "transparent",
    color: active ? "#2c2416" : "#b8a882",
    border: `1px solid ${active ? "#c8a96e" : "#4a3f2e"}`,
    borderRadius: 20,
    padding: "6px 12px",
    fontSize: 12,
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: 0.5,
    fontWeight: active ? 700 : 400,
    whiteSpace: "nowrap",
  });

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: "#faf8f4", color: "#2c2416" }}>
      {/* Header */}
      <div
        style={{
          background: "#2c2416",
          color: "#faf8f4",
          padding: "20px 16px 16px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#b8a882", marginBottom: 4 }}>
            Bell Family
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Meal Planner</div>
          <div style={{ fontSize: 12, color: "#b8a882", marginTop: 3 }}>
            {days[0].label} – {days[days.length - 1].label}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setTab("menu")} style={btnStyle(tab === "menu")}>🍽️ Menu</button>
          <button onClick={() => setTab("plan")} style={btnStyle(tab === "plan")}>📅 Plan</button>
          <button onClick={() => setTab("shopping")} style={btnStyle(tab === "shopping")}>🛒 Shopping</button>
          <button onClick={() => setTab("history")} style={btnStyle(tab === "history")}>📖 History</button>
        </div>
      </div>

      {!dbOk && tab === "shopping" && (
        <div
          style={{
            background: "#fdecec",
            color: "#8a2020",
            fontSize: 12,
            padding: "8px 16px",
            textAlign: "center",
          }}
        >
          ⚠️ Can't reach the family database — changes may only show on this device.
        </div>
      )}

      {/* ============ MENU (blackboard) ============ */}
      {tab === "menu" && (
        <div style={{ padding: "20px 12px 40px", maxWidth: 560, margin: "0 auto" }}>
          <div
            style={{
              background: "#28332c",
              backgroundImage:
                "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.05), transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(255,255,255,0.04), transparent 50%)",
              border: "12px solid #7a5230",
              borderRadius: 8,
              boxShadow: "0 6px 24px rgba(0,0,0,0.35), inset 0 0 60px rgba(0,0,0,0.45)",
              padding: "28px 20px 32px",
              fontFamily: "'Chalkboard SE', 'Comic Sans MS', 'Segoe Print', cursive",
              color: "#f4f0e4",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 13, letterSpacing: 3, color: "#d8cfae", opacity: 0.85 }}>
                ✦ BELL FAMILY ✦
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, marginTop: 2, textShadow: "0 0 6px rgba(244,240,228,0.25)" }}>
                The Next 7 Days
              </div>
              <div
                style={{
                  width: 160,
                  height: 3,
                  margin: "10px auto 18px",
                  background: "#f4f0e4",
                  opacity: 0.5,
                  borderRadius: 3,
                  transform: "rotate(-0.5deg)",
                }}
              />
            </div>

            {days.map((d) => {
              const isToday = d.isToday;
              const meal = meals[d.key];
              return (
                <div
                  key={d.key}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    padding: "9px 10px",
                    marginBottom: 4,
                    borderRadius: 8,
                    background: isToday ? "rgba(244,228,160,0.12)" : "transparent",
                    border: isToday ? "1.5px dashed rgba(244,228,160,0.55)" : "1.5px dashed transparent",
                  }}
                >
                  <div
                    style={{
                      width: 86,
                      flexShrink: 0,
                      fontSize: 15,
                      color: isToday ? "#f4e4a0" : "#cfd8c4",
                      letterSpacing: 1,
                    }}
                  >
                    {d.weekday.toUpperCase().slice(0, 3)}
                    {isToday && <span style={{ fontSize: 10, marginLeft: 5 }}>★</span>}
                  </div>
                  <div
                    style={{
                      fontSize: meal ? 21 : 16,
                      fontWeight: meal ? 700 : 400,
                      color: meal ? "#fdfaf0" : "rgba(244,240,228,0.35)",
                      lineHeight: 1.25,
                    }}
                  >
                    {meal || "chef's choice…"}
                    {notes[d.key] && meal && (
                      <span style={{ fontSize: 12, fontWeight: 400, color: "#d8cfae", marginLeft: 8 }}>
                        ({notes[d.key]})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#d8cfae", opacity: 0.7 }}>
              ~ bon appétit ~
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#b8a882", marginTop: 12 }}>
            Updates by itself when the plan changes
          </div>
        </div>
      )}

      {/* ============ PLAN ============ */}
      {tab === "plan" && (
        <div style={{ padding: "20px 16px", maxWidth: 680, margin: "0 auto" }}>
          {days.map((d) => {
            const key = d.key;
            const events = dayEvents(key);
            const alert = hasAlert(key);
            const isEditing = editingKey === key;
            const meal = meals[key];

            return (
              <div
                key={key}
                style={{
                  background: "#fff",
                  border: `1.5px solid ${d.isToday ? "#c8a96e" : alert ? "#f0d8b8" : "#e8e0d0"}`,
                  borderRadius: 10,
                  marginBottom: 10,
                  overflow: "hidden",
                  boxShadow: d.isToday ? "0 1px 6px rgba(200,169,110,0.25)" : "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 14px 8px",
                    borderBottom: "1px solid #f0ece4",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#2c2416",
                      color: "#faf8f4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    {d.weekday.slice(0, 3).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {d.weekday}
                      <span style={{ fontSize: 12, fontWeight: 400, color: "#b8a882", marginLeft: 6 }}>
                        {d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      {d.isToday && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#2c2416",
                            background: "#c8a96e",
                            borderRadius: 10,
                            padding: "1px 7px",
                            marginLeft: 8,
                            letterSpacing: 0.5,
                          }}
                        >
                          TODAY
                        </span>
                      )}
                    </div>
                    {events.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                        {events.map((ev, j) => (
                          <span
                            key={j}
                            style={{
                              background: ev.isOut ? "#fde8e8" : "#e8f0e8",
                              color: ev.isOut ? "#8a2020" : "#2a5a2a",
                              fontSize: 10,
                              padding: "2px 7px",
                              borderRadius: 10,
                              fontWeight: 600,
                              letterSpacing: 0.3,
                            }}
                          >
                            {ev.isOut ? `⚠️ ${ev.who} out — ${ev.title}` : `📍 ${ev.title} (${ev.time})`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ padding: "10px 14px 12px" }}>
                  {isEditing ? (
                    <div>
                      <div style={{ position: "relative" }}>
                        <input
                          value={inputVal}
                          onChange={(e) => {
                            setInputVal(e.target.value);
                            setBrowsing(false);
                            setShowSuggestions(true);
                          }}
                          onFocus={() => { if (browsing) setShowSuggestions(true); }}
                          placeholder="What's for dinner?"
                          autoFocus
                          style={{
                            width: "100%",
                            border: "1.5px solid #c8a96e",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 14,
                            fontFamily: "inherit",
                            background: "#fffdf8",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                        {showSuggestions && filteredSuggestions.length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              background: "#fff",
                              border: "1.5px solid #d4c9b0",
                              borderRadius: 6,
                              zIndex: 10,
                              maxHeight: browsing ? 220 : 160,
                              overflowY: "auto",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                            }}
                          >
                            {filteredSuggestions.map((s) => (
                              <div
                                key={s}
                                onClick={() => pickSuggestion(s)}
                                style={{
                                  padding: "8px 12px",
                                  fontSize: 13,
                                  cursor: "pointer",
                                  borderBottom: "1px solid #f0ece4",
                                }}
                              >
                                {s}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {aiMeal && (
                        <div
                          style={{
                            background: "#f8f4ec",
                            border: "1px solid #d4c9b0",
                            borderRadius: 6,
                            padding: "8px 10px",
                            fontSize: 12,
                            color: "#6b5c3e",
                            marginTop: 6,
                          }}
                        >
                          <strong>✨ AI suggestion:</strong> {aiMeal.meal} — {aiMeal.note}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => saveEdit(key)}
                          style={{
                            background: "#2c2416",
                            color: "#faf8f4",
                            border: "none",
                            borderRadius: 6,
                            padding: "7px 16px",
                            fontSize: 12,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => askAI(key, d.weekday)}
                          disabled={aiLoading}
                          style={{
                            background: aiLoading ? "#e8e0d0" : "#c8a96e",
                            color: aiLoading ? "#aaa" : "#2c2416",
                            border: "none",
                            borderRadius: 6,
                            padding: "7px 14px",
                            fontSize: 12,
                            fontFamily: "inherit",
                            cursor: aiLoading ? "default" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {aiLoading ? "Thinking..." : "✨ Ask AI"}
                        </button>
                        <button
                          onClick={() => { setBrowsing(true); setShowSuggestions(true); }}
                          style={{
                            background: browsing ? "#ede8dc" : "transparent",
                            color: "#6b5c3e",
                            border: "1px solid #d4c9b0",
                            borderRadius: 6,
                            padding: "7px 12px",
                            fontSize: 12,
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          Browse favorites
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          style={{
                            background: "transparent",
                            color: "#aaa",
                            border: "none",
                            padding: "7px 8px",
                            fontSize: 12,
                            fontFamily: "inherit",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      <input
                        value={notes[key] || ""}
                        onChange={(e) => {
                          const nextNotes = { ...notes, [key]: e.target.value };
                          setNotes(nextNotes);
                          syncMeals(meals, nextNotes);
                        }}
                        placeholder="Add a note (guests, kids eating separately, etc.)"
                        style={{
                          marginTop: 8,
                          width: "100%",
                          border: "1px solid #e0d8c8",
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          fontFamily: "inherit",
                          color: "#6b5c3e",
                          background: "#fdfbf8",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => startEdit(key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        minHeight: 36,
                      }}
                    >
                      {meal ? (
                        <>
                          <span style={{ fontSize: 15, flex: 1, fontWeight: 500 }}>{meal}</span>
                          {notes[key] && (
                            <span style={{ fontSize: 11, color: "#9a8a6e", fontStyle: "italic" }}>{notes[key]}</span>
                          )}
                          <span style={{ fontSize: 11, color: "#b8a882" }}>edit ✏️</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 13, color: "#b8a882", fontStyle: "italic" }}>
                          + Tap to plan dinner
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add recipe */}
          {!recipeOpen ? (
            <button
              onClick={() => setRecipeOpen(true)}
              style={{
                display: "block",
                width: "100%",
                background: "#fff",
                border: "1.5px dashed #c8a96e",
                borderRadius: 10,
                padding: "14px",
                fontSize: 14,
                fontFamily: "inherit",
                color: "#6b5c3e",
                cursor: "pointer",
                marginTop: 6,
              }}
            >
              📖 Add a recipe — paste a link or the recipe itself
            </button>
          ) : (
            <div
              style={{
                background: "#fff",
                border: "1.5px solid #c8a96e",
                borderRadius: 10,
                padding: "14px",
                marginTop: 6,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>📖 Add a recipe</strong>
                <button
                  onClick={closeRecipe}
                  style={{ background: "transparent", border: "none", color: "#aaa", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}
                >
                  ✕
                </button>
              </div>

              {!recipeParsed && (
                <>
                  <textarea
                    value={recipeInput}
                    onChange={(e) => setRecipeInput(e.target.value)}
                    placeholder={"Paste a recipe link (https://...)\nor copy & paste the whole recipe here"}
                    rows={4}
                    style={{
                      width: "100%",
                      border: "1px solid #d4c9b0",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      background: "#fffdf8",
                      outline: "none",
                      boxSizing: "border-box",
                      resize: "vertical",
                    }}
                  />
                  <button
                    onClick={parseRecipe}
                    disabled={recipeLoading || !recipeInput.trim()}
                    style={{
                      marginTop: 8,
                      background: recipeLoading ? "#e8e0d0" : "#2c2416",
                      color: recipeLoading ? "#aaa" : "#faf8f4",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 18px",
                      fontSize: 13,
                      fontFamily: "inherit",
                      cursor: recipeLoading ? "default" : "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {recipeLoading ? "Reading recipe..." : "Read recipe"}
                  </button>
                </>
              )}

              {recipeParsed && (
                <div>
                  <label style={{ fontSize: 11, color: "#9a8a6e", letterSpacing: 1, textTransform: "uppercase" }}>
                    Name
                  </label>
                  <input
                    value={recipeParsed.name}
                    onChange={(e) => setRecipeParsed({ ...recipeParsed, name: e.target.value })}
                    style={{
                      width: "100%",
                      border: "1px solid #d4c9b0",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 14,
                      fontFamily: "inherit",
                      background: "#fffdf8",
                      outline: "none",
                      boxSizing: "border-box",
                      marginBottom: 10,
                      marginTop: 4,
                    }}
                  />
                  <label style={{ fontSize: 11, color: "#9a8a6e", letterSpacing: 1, textTransform: "uppercase" }}>
                    Shopping list ingredients ({recipeParsed.ingredients.length})
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "6px 0 10px" }}>
                    {recipeParsed.ingredients.map((ing, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: "#f4efe4",
                          border: "1px solid #e0d8c8",
                          borderRadius: 14,
                          padding: "4px 10px",
                          fontSize: 12,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {ing}
                        <span
                          onClick={() =>
                            setRecipeParsed({
                              ...recipeParsed,
                              ingredients: recipeParsed.ingredients.filter((_, j) => j !== idx),
                            })
                          }
                          style={{ cursor: "pointer", color: "#b09a70", fontWeight: 700 }}
                        >
                          ✕
                        </span>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    <input
                      value={newIngredient}
                      onChange={(e) => setNewIngredient(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newIngredient.trim()) {
                          setRecipeParsed({
                            ...recipeParsed,
                            ingredients: [...recipeParsed.ingredients, newIngredient.trim()],
                          });
                          setNewIngredient("");
                        }
                      }}
                      placeholder="Add an ingredient..."
                      style={{
                        flex: 1,
                        border: "1px solid #e0d8c8",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontFamily: "inherit",
                        outline: "none",
                      }}
                    />
                  </div>

                  {recipeSaved ? (
                    <div style={{ fontSize: 13, color: "#2a5a2a", background: "#e8f0e8", borderRadius: 6, padding: "10px 12px" }}>
                      ✓ Saved to favorites! Plan it on any day and the ingredients go straight to the
                      shopping list.
                      <button
                        onClick={() => {
                          shoppingAction({ action: "add", names: recipeParsed.ingredients });
                          closeRecipe();
                          setTab("shopping");
                        }}
                        style={{
                          display: "block",
                          marginTop: 8,
                          background: "#2a5a2a",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "7px 12px",
                          fontSize: 12,
                          fontFamily: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        🛒 Also add ingredients to this week's list now
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={saveRecipe}
                        disabled={recipeLoading}
                        style={{
                          background: "#2c2416",
                          color: "#faf8f4",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 18px",
                          fontSize: 13,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        {recipeLoading ? "Saving..." : "Save to favorites"}
                      </button>
                      <button
                        onClick={() => setRecipeParsed(null)}
                        style={{
                          background: "transparent",
                          color: "#6b5c3e",
                          border: "1px solid #d4c9b0",
                          borderRadius: 6,
                          padding: "8px 12px",
                          fontSize: 13,
                          fontFamily: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        Start over
                      </button>
                    </div>
                  )}
                </div>
              )}
              {recipeError && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#8a2020" }}>⚠️ {recipeError}</div>
              )}
            </div>
          )}

          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#b8a882",
              marginTop: 16,
              letterSpacing: 0.5,
            }}
          >
            Tap any day to edit • Planned dinners add their ingredients to the shopping list
          </div>
        </div>
      )}

      {/* ============ SHOPPING ============ */}
      {tab === "shopping" && (
        <div style={{ padding: "20px 16px 60px", maxWidth: 680, margin: "0 auto" }}>
          {/* This week's meals summary */}
          <div
            style={{
              background: "#2c2416",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 14,
              color: "#faf8f4",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#b8a882", marginBottom: 8 }}>
              Upcoming meals
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {days.map(
                (d) =>
                  meals[d.key] && (
                    <span
                      key={d.key}
                      style={{
                        background: "#3d3020",
                        borderRadius: 14,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: "#e8d8b8",
                      }}
                    >
                      <span style={{ color: "#b8a882" }}>{d.weekday.slice(0, 3)}</span> {meals[d.key]}
                    </span>
                  )
              )}
            </div>
          </div>

          {/* Add item — everyone can add all week */}
          <div
            style={{
              background: "#fff",
              border: "1.5px dashed #c8a96e",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
              placeholder="Need something? Add it here..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontFamily: "inherit",
                fontSize: 14,
                background: "transparent",
                color: "#2c2416",
              }}
            />
            <button
              onClick={addCustomItem}
              style={{
                background: "#2c2416",
                color: "#faf8f4",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              + Add
            </button>
          </div>

          <div
            style={{
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#6b5c3e",
              marginBottom: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Shopping List</span>
            <span style={{ fontSize: 10, color: "#b8a882" }}>
              {checkedCount} / {items.length} in the cart
            </span>
          </div>

          {items.length === 0 && (
            <div style={{ fontSize: 13, color: "#b8a882", fontStyle: "italic", textAlign: "center", padding: 20 }}>
              Nothing yet — plan some dinners or add items above.
            </div>
          )}

          {CATEGORIES.map((cat) => {
            const group = itemsByCategory[cat] || [];
            if (group.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#6b5c3e",
                    margin: "0 0 6px 2px",
                    letterSpacing: 0.5,
                  }}
                >
                  {CATEGORY_EMOJI[cat]} {cat}
                  <span style={{ fontWeight: 400, color: "#b8a882", marginLeft: 6, fontSize: 11 }}>
                    {group.filter((i) => i.checked).length}/{group.length}
                  </span>
                </div>
                {group.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      background: item.checked ? "#f0ece4" : "#fff",
                      border: "1px solid #e8e0d0",
                      borderRadius: 8,
                      marginBottom: 5,
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      onClick={() => toggleItem(item.id)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: `2px solid ${item.checked ? "#c8a96e" : "#d4c9b0"}`,
                        background: item.checked ? "#c8a96e" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {item.checked ? "✓" : ""}
                    </div>
                    <span
                      onClick={() => toggleItem(item.id)}
                      style={{
                        fontSize: 14,
                        flex: 1,
                        cursor: "pointer",
                        textDecoration: item.checked ? "line-through" : "none",
                        color: item.checked ? "#b8a882" : "#2c2416",
                      }}
                    >
                      {item.name}
                      {item.meal && (
                        <span style={{ fontSize: 10, color: "#b8a882", marginLeft: 7 }}>
                          {item.meal}
                        </span>
                      )}
                    </span>
                    <span
                      onClick={() => removeItem(item.id)}
                      style={{
                        color: "#d4c9b0",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "0 4px",
                        fontWeight: 700,
                      }}
                    >
                      ✕
                    </span>
                  </div>
                ))}
              </div>
            );
          })}

          {checkedCount > 0 && (
            <button
              onClick={() => shoppingAction({ action: "uncheckAll" })}
              style={{
                display: "block",
                margin: "16px auto 0",
                background: "transparent",
                border: "none",
                color: "#b8a882",
                fontSize: 12,
                fontFamily: "inherit",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Uncheck everything
            </button>
          )}
        </div>
      )}

      {/* ============ HISTORY ============ */}
      {tab === "history" && (
        <div style={{ padding: "20px 16px 60px", maxWidth: 680, margin: "0 auto" }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Meal history</div>
            <div style={{ fontSize: 12, color: "#9a8a6e", marginTop: 3 }}>
              Every dinner you've planned, most recent first.
            </div>
          </div>

          {historyEntries.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1.5px dashed #e8e0d0",
                borderRadius: 10,
                padding: "28px 16px",
                textAlign: "center",
                color: "#b8a882",
                fontSize: 14,
              }}
            >
              No past meals yet — they'll show up here as the days roll by.
            </div>
          ) : (
            (() => {
              let lastMonth = null;
              return historyEntries.map((k) => {
                // k is "YYYY-MM-DD"; build a local Date for display (noon avoids TZ drift).
                const date = new Date(`${k}T12:00:00`);
                const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                const showMonth = monthLabel !== lastMonth;
                lastMonth = monthLabel;
                return (
                  <div key={k}>
                    {showMonth && (
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: "#b8a882",
                          margin: "16px 2px 8px",
                          fontWeight: 700,
                        }}
                      >
                        {monthLabel}
                      </div>
                    )}
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid #e8e0d0",
                        borderRadius: 10,
                        marginBottom: 8,
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "baseline",
                        gap: 12,
                      }}
                    >
                      <div style={{ width: 96, flexShrink: 0, fontSize: 12, color: "#9a8a6e" }}>
                        {date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 15, fontWeight: 500 }}>{meals[k]}</span>
                        {notes[k] && (
                          <span style={{ fontSize: 11, color: "#9a8a6e", fontStyle: "italic", marginLeft: 8 }}>
                            {notes[k]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      )}
    </div>
  );
}
