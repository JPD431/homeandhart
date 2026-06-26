"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BRAND } from "@/app/components/brand";
import { searchCiudadesEspana } from "@/app/lib/mapboxGeocoding";

const DEBOUNCE_MS = 300;

export default function CiudadAutocompleteInput({
  value,
  onChange,
  placeholder,
  className = "",
  inputClassName = "",
  id,
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchCiudadesEspana(trimmed, {
          signal: controller.signal,
        });
        setSuggestions(results);
        setOpen(results.length > 0);
        setActiveIndex(results.length > 0 ? 0 : -1);
      } catch (err) {
        if (err?.name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
          setActiveIndex(-1);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectSuggestion(suggestion) {
    onChange(suggestion.nombre);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1,
      );
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    }
  }

  const showList = open && suggestions.length > 0;

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        autoComplete="off"
        className={inputClassName}
        style={{ color: "#2a3a4a" }}
      />

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto border bg-white py-1 shadow-lg"
          style={{ borderColor: BRAND.border, borderRadius: 6 }}
        >
          {suggestions.map((suggestion, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={suggestion.id}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={isActive}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className="w-full px-3 py-2 text-left transition-colors"
                  style={{
                    backgroundColor: isActive ? BRAND.light : "#fff",
                    color: "#2a3a4a",
                  }}
                >
                  <span className="block text-[12px] font-medium">
                    {suggestion.nombre}
                  </span>
                  {suggestion.etiqueta !== suggestion.nombre && (
                    <span className="mt-0.5 block text-[10px] text-[#888]">
                      {suggestion.etiqueta}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {loading && value.trim().length >= 2 && !showList && (
        <p
          className="pointer-events-none absolute left-0 top-full mt-1 px-1 text-[10px] text-[#bbb]"
          aria-hidden
        >
          …
        </p>
      )}
    </div>
  );
}
