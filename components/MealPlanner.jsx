"use client";

import { useState, useEffect, useRef } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Calendar events from the Bell family calendar this week
const CALENDAR_EVENTS = {
  Monday: [],
  Tuesday: [
    { time: "4–6pm", title: "Sini staff training", who: "Julie" },
  ],
  Wednesday: [
    { time: "3–7:30pm", title: "Joshua Track Meet", who: "Joshua" },
    { time: "7:50am", title: "Wildwood Mileage Club", who: "Kids" },
  ],
  Thursday: [
    { time: "7–9pm", title: "Chris: Dinner w Lisa", who: "Chris", isOut: true },
  ],
  Friday: [
    { time: "3–7:30pm", title: "Joshua Track Meet", who: "Joshua" },
    { time: "5–7pm", title: "Affinity End of Year", who: "Julie", isOut: true },
  ],
  Saturday: [],
  Sunday: [
    { time: "All Day", title: "Mother's Day 🌸", who: "Family", isMothersDay: true },
    { time: "1pm", title: "E: Into the Woods", who: "E" },
  ],
};

const MEAL_SUGGESTIONS = [
  "Spicy scallop hand rolls",
  "Sashimi",
  "Tacos",
  "Pasta & sausage",
  "Chicken tinga",
  "Crispy chicken",
  "Tri-tip & salad",
  "Burgers",
  "3 cup chicken",
  "Shrimp stir fry",
  "Pork pasta",
  "Mac n cheese",
  "Gnocchi w/ sausage",
  "Chicken Caesar salad",
  "Shrimp risotto",
  "Turkey udon",
  "Korean beef lettuce wraps",
  "Steaks",
  "Enchiladas",
  "Pork pozole",
  "Grilled chicken & salad",
  "Fish tacos",
  "Lamb skewers",
  "White bean chicken chili",
  "Crispy rice salmon salad",
  "Chicken risotto",
];

const AI_SUGGESTIONS = {
  Monday: { meal: "Tacos", note: "Easy weeknight after the weekend's hand rolls" },
  Tuesday: { meal: "Crispy chicken", note: "Staff training til 6 — quick to execute" },
  Wednesday: { meal: "Mac n cheese", note: "Joshua track meet til 7:30 — easy for kids" },
  Thursday: { meal: "Pasta & sausage", note: "Chris is out — simple crowd pleaser" },
  Friday: { meal: "Grilled chicken & salad", note: "Julie has Affinity event, keep it light" },
  Saturday: { meal: "Pork pasta", note: "Weekend cook, family favorite" },
  Sunday: {
    meal: "Something special for Julie! 🌸",
    note: "Mother's Day — make it a celebration",
  },
};

const DEFAULT_MEALS = {
  Monday: "Tacos",
  Tuesday: "Crispy chicken",
  Wednesday: "Mac n cheese",
  Thursday: "Pasta & sausage",
  Friday: "Grilled chicken & salad",
  Saturday: "",
  Sunday: "",
};

const SHOPPING_CATEGORIES = {
  Proteins: ["chicken breast (3 lbs)", "ground turkey (1 lb)", "sausage", "salmon", "shrimp"],
  Produce: ["broccoli", "kale", "green beans", "avocado", "garlic", "onions"],
  Pantry: ["pasta (penne)", "tortillas", "masa harina", "olive oil", "canned tomatoes"],
  Dairy: ["parmesan", "cheddar (block)", "eggs", "butter", "cream cheese"],
  Bakery: ["bagels", "sourdough"],
};

const generateShoppingList = (meals) => {
  const items = new Set();
  const mealText = Object.values(meals).join(" ").toLowerCase();

  if (mealText.includes("taco")) {
    ["ground turkey (1 lb)", "masa harina", "tortillas", "taco cheese", "salsa"].forEach((i) => items.add(i));
  }
  if (mealText.includes("pasta") || mealText.includes("penne")) {
    ["penne pasta", "parmesan", "sausage"].forEach((i) => items.add(i));
  }
  if (mealText.includes("chicken")) {
    items.add("chicken breast (3 lbs)");
  }
  if (mealText.includes("mac n cheese") || mealText.includes("mac")) {
    ["cheddar (block)", "butter", "pasta"].forEach((i) => items.add(i));
  }
  if (mealText.includes("shrimp")) {
    items.add("shrimp (1 lb)");
  }
  if (mealText.includes("salmon")) {
    items.add("salmon");
  }
  if (mealText.includes("burger")) {
    ["ground beef (2 lbs)", "burger buns", "cheddar slices"].forEach((i) => items.add(i));
  }
  if (mealText.includes("salad")) {
    ["romaine / arugula", "parmesan"].forEach((i) => items.add(i));
  }

  // always
  ["garlic", "onions", "broccoli", "green beans", "bagels", "cream cheese", "eggs", "butter"].forEach((i) =>
    items.add(i)
  );

  return Array.from(items);
};

export default function MealPlanner() {
  const [meals, setMeals] = useState(DEFAULT_MEALS);
  const [notes, setNotes] = useState({});
  const [checked, setChecked] = useState({});
  const [customItems, setCustomItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [activeDay, setActiveDay] = useState("Monday");
  const [editingDay, setEditingDay] = useState(null);
  const [inputVal, setInputVal] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [browsing, setBrowsing] = useState(false); // true = show all favorites, false = filter by input
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMeal, setAiMeal] = useState(null);
  const [tab, setTab] = useState("plan"); // plan | shopping
  const [highlightDay, setHighlightDay] = useState(null);

  const syncTimeout = useRef(null);
  const mealSyncTimeout = useRef(null);

  // Poll meal plan every 5 seconds while on the plan tab
  useEffect(() => {
    if (tab !== "plan") return;

    const sync = () =>
      fetch("/api/meals")
        .then((r) => r.json())
        .then((data) => {
          if (data.meals) setMeals(data.meals);
          if (data.notes) setNotes(data.notes);
        })
        .catch(() => {});

    sync();
    const interval = setInterval(sync, 5000);
    return () => clearInterval(interval);
  }, [tab]);

  const syncMeals = (nextMeals, nextNotes) => {
    if (mealSyncTimeout.current) clearTimeout(mealSyncTimeout.current);
    mealSyncTimeout.current = setTimeout(() => {
      fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meals: nextMeals, notes: nextNotes }),
      }).catch(() => {});
    }, 500);
  };

  // Poll for updates every 2 seconds while on the shopping tab
  useEffect(() => {
    if (tab !== "shopping") return;

    const sync = () =>
      fetch("/api/shopping")
        .then((r) => r.json())
        .then((data) => setChecked(data))
        .catch(() => {});

    sync();
    const interval = setInterval(sync, 2000);
    return () => clearInterval(interval);
  }, [tab]);

  // Write to DB with 500 ms debounce
  const syncToServer = (checkedState) => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      fetch("/api/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checkedState),
      }).catch(() => {});
    }, 500);
  };

  const shoppingList = generateShoppingList(meals);

  const startEdit = (day) => {
    setEditingDay(day);
    setInputVal(meals[day] || "");
    setShowSuggestions(false);
    setBrowsing(false);
    setAiMeal(null);
  };

  const saveEdit = (day) => {
    const nextMeals = { ...meals, [day]: inputVal };
    setMeals(nextMeals);
    setEditingDay(null);
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

  const askAI = async (day) => {
    setAiLoading(true);
    setAiMeal(null);
    const history = `Recent family meals: scallop hand rolls, sashimi, tacos, enchiladas, grilled chicken pasta.
Family preferences: seafood (scallops, shrimp, salmon), Asian stir-fries (3 cup chicken, Korean beef wraps, turkey udon), Italian (pasta, gnocchi, risotto), tacos, burgers, crispy chicken.
Dislikes: nothing noted. One picky eater (E) who sometimes gets separate food.
Calendar note for ${day}: ${
      CALENDAR_EVENTS[day]?.length
        ? CALENDAR_EVENTS[day].map((e) => `${e.title} (${e.time})`).join(", ")
        : "nothing special"
    }`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: `${history}\n\nSuggest ONE meal for ${day} this week. Consider the calendar events. Reply ONLY in this JSON: {"meal": "...", "note": "..."}`,
            },
          ],
        }),
      });
      const data = await res.json();
      const text = data.content?.find((b) => b.type === "text")?.text || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAiMeal(parsed);
      setInputVal(parsed.meal);
    } catch {
      setAiMeal({ meal: AI_SUGGESTIONS[day]?.meal || "Tacos", note: AI_SUGGESTIONS[day]?.note || "" });
      setInputVal(AI_SUGGESTIONS[day]?.meal || "Tacos");
    }
    setAiLoading(false);
  };

  const toggleItem = (item) => {
    const next = { ...checked, [item]: !checked[item] };
    setChecked(next);
    syncToServer(next);
  };

  const addCustomItem = () => {
    if (newItem.trim()) {
      setCustomItems((ci) => [...ci, newItem.trim()]);
      setNewItem("");
    }
  };

  const dayEvents = (day) => CALENDAR_EVENTS[day] || [];
  const hasAlert = (day) => dayEvents(day).some((e) => e.isOut || e.isMothersDay);
  const isMothersDay = (day) => dayEvents(day).some((e) => e.isMothersDay);

  const filteredSuggestions = browsing
    ? MEAL_SUGGESTIONS.filter((s) => s !== inputVal)
    : MEAL_SUGGESTIONS.filter(
        (s) => inputVal.length > 0 && s.toLowerCase().includes(inputVal.toLowerCase()) && s !== inputVal
      ).slice(0, 6);

  return (
    <div style={{ fontFamily: "'Georgia', serif", minHeight: "100vh", background: "#faf8f4", color: "#2c2416" }}>
      {/* Header */}
      <div
        style={{
          background: "#2c2416",
          color: "#faf8f4",
          padding: "24px 28px 20px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#b8a882", marginBottom: 4 }}>
            Bell Family
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>Weekly Meal Planner</div>
          <div style={{ fontSize: 12, color: "#b8a882", marginTop: 3 }}>Week of May 4, 2026</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["plan", "shopping"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: tab === t ? "#c8a96e" : "transparent",
                color: tab === t ? "#2c2416" : "#b8a882",
                border: `1px solid ${tab === t ? "#c8a96e" : "#4a3f2e"}`,
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 12,
                fontFamily: "inherit",
                cursor: "pointer",
                letterSpacing: 1,
                textTransform: "capitalize",
                fontWeight: tab === t ? 700 : 400,
              }}
            >
              {t === "shopping" ? "🛒 Shopping" : "📅 Meal Plan"}
            </button>
          ))}
        </div>
      </div>

      {tab === "plan" && (
        <div style={{ padding: "20px 16px", maxWidth: 680, margin: "0 auto" }}>
          {/* Already planned note */}
          <div
            style={{
              background: "#ede8dc",
              border: "1px solid #d4c9b0",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#6b5c3e",
              marginBottom: 20,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <span>📌</span>
            <span>
              <strong>Already planned:</strong> Monday — scallop hand rolls & sashimi, Tuesday — tacos. Filling in the
              rest below.
            </span>
          </div>

          {DAYS.map((day, i) => {
            const events = dayEvents(day);
            const alert = hasAlert(day);
            const special = isMothersDay(day);
            const isEditing = editingDay === day;
            const meal = meals[day];

            return (
              <div
                key={day}
                style={{
                  background: special ? "#fff8f0" : "#fff",
                  border: `1.5px solid ${special ? "#e8c080" : alert ? "#f0d8b8" : "#e8e0d0"}`,
                  borderRadius: 10,
                  marginBottom: 10,
                  overflow: "hidden",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                {/* Day Header */}
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
                      background: special ? "#c8a96e" : "#2c2416",
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
                    {SHORT_DAYS[i]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{day}</div>
                    {events.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
                        {events.map((ev, j) => (
                          <span
                            key={j}
                            style={{
                              background: ev.isMothersDay
                                ? "#fce8cc"
                                : ev.isOut
                                ? "#fde8e8"
                                : "#e8f0e8",
                              color: ev.isMothersDay ? "#8a5a00" : ev.isOut ? "#8a2020" : "#2a5a2a",
                              fontSize: 10,
                              padding: "2px 7px",
                              borderRadius: 10,
                              fontWeight: 600,
                              letterSpacing: 0.3,
                            }}
                          >
                            {ev.isOut ? `⚠️ ${ev.who} out` : ev.isMothersDay ? `🌸 ${ev.title}` : `📍 ${ev.title}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Meal Area */}
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
                                onMouseEnter={(e) => (e.target.style.background = "#faf6ee")}
                                onMouseLeave={(e) => (e.target.style.background = "transparent")}
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
                          onClick={() => saveEdit(day)}
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
                          onClick={() => askAI(day)}
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
                          onClick={() => setEditingDay(null)}
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
                      {/* Notes */}
                      <input
                        value={notes[day] || ""}
                        onChange={(e) => {
                          const nextNotes = { ...notes, [day]: e.target.value };
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
                      onClick={() => startEdit(day)}
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
                          {notes[day] && (
                            <span style={{ fontSize: 11, color: "#9a8a6e", fontStyle: "italic" }}>{notes[day]}</span>
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

          {/* Quick tip */}
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#b8a882",
              marginTop: 16,
              letterSpacing: 0.5,
            }}
          >
            Tap any day to edit • ✨ Ask AI pulls suggestions from your family's history
          </div>
        </div>
      )}

      {tab === "shopping" && (
        <div style={{ padding: "20px 16px", maxWidth: 680, margin: "0 auto" }}>
          {/* This week's meals summary */}
          <div
            style={{
              background: "#2c2416",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: 16,
              color: "#faf8f4",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#b8a882", marginBottom: 8 }}>
              This week's meals
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DAYS.map(
                (day) =>
                  meals[day] && (
                    <span
                      key={day}
                      style={{
                        background: "#3d3020",
                        borderRadius: 14,
                        padding: "4px 10px",
                        fontSize: 11,
                        color: "#e8d8b8",
                      }}
                    >
                      <span style={{ color: "#b8a882" }}>{SHORT_DAYS[DAYS.indexOf(day)]}</span> {meals[day]}
                    </span>
                  )
              )}
            </div>
          </div>

          {/* Auto-generated list */}
          <div style={{ marginBottom: 20 }}>
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
                {Object.values(checked).filter(Boolean).length} / {shoppingList.length + customItems.length} checked
              </span>
            </div>

            {[...shoppingList, ...customItems].map((item) => (
              <div
                key={item}
                onClick={() => toggleItem(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  background: checked[item] ? "#f0ece4" : "#fff",
                  border: "1px solid #e8e0d0",
                  borderRadius: 8,
                  marginBottom: 6,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    border: `2px solid ${checked[item] ? "#c8a96e" : "#d4c9b0"}`,
                    background: checked[item] ? "#c8a96e" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {checked[item] ? "✓" : ""}
                </div>
                <span
                  style={{
                    fontSize: 14,
                    flex: 1,
                    textDecoration: checked[item] ? "line-through" : "none",
                    color: checked[item] ? "#b8a882" : "#2c2416",
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>

          {/* Add custom item */}
          <div
            style={{
              background: "#fff",
              border: "1.5px dashed #d4c9b0",
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
              placeholder="Add item..."
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

          {/* Clear checked */}
          {Object.values(checked).some(Boolean) && (
            <button
              onClick={() => {
                const empty = {};
                setChecked(empty);
                syncToServer(empty);
              }}
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
              Clear all checks
            </button>
          )}
        </div>
      )}
    </div>
  );
}
