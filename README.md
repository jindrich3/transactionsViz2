# Investment Transaction Dashboard 📊

Moderní webová aplikace pro analýzu investičních transakcí z CSV souborů s profesionálním designem inspirovaným investown.cz.

## 🌟 Funkce

### 🏠 Úvodní stránka
- **Elegantní hero sekce** s gradient pozadím a animacemi
- **Drag & drop nahrávání** CSV souborů
- **Validace souborů** a chybová hlášení
- **Loading indikátory** a úspěšné animace
- **Responzivní design** pro všechna zařízení

### 📈 Dashboard
#### Statistické karty
- **Celková investice** - součet všech kladných částek
- **Celkové výběry** - součet všech záporných částek  
- **Čistá pozice** - rozdíl mezi investicemi a výběry
- **Počet transakcí** - celkový počet záznamů
- **Aktivní projekty** - počet unikátních projektů
- **Průměrná transakce** - průměrná částka transakce
- **Největší investice** - nejvyšší jednotlivá investice
- **Diverzifikace portfolia** - počet různých typů projektů

#### 📊 Grafy a vizualizace
1. **Hlavní sloupcový graf** - transakce podle typu (příjmy vs výdaje)
2. **Časový graf** - vývoj částek v čase (měsíčně)
3. **Koláčový graf** - rozdělení podle typu projektu
4. **Horizontální graf** - top 10 projektů podle celkové částky

#### 🔍 Filtrování
- **Časové období** - výběr dat od-do s rychlými presety
- **Projekty** - multi-select s vyhledáváním
- **Typ transakce** - tlačítka s počítadly
- **Globální vyhledávání** - hledání napříč všemi poli

#### 📋 Datová tabulka
- **Řazení** podle všech sloupců
- **Stránkování** pro velké datasety
- **Responzivní design** pro mobily
- **Export do CSV** s filtrovanými daty

#### 📊 Pokročilé statistiky
- **Měsíční investiční sazba**
- **Nejdelší investiční série**
- **Sezónní vzorce**
- **Koncentrace investic (Top 5)**
- **Průměrné dny mezi transakcemi**

## 🚀 Technologie

- **HTML5** - sémantická struktura
- **CSS3** - moderní styling s CSS Grid/Flexbox
- **JavaScript ES6+** - funkcionalita a logika
- **Chart.js** - interaktivní grafy s animacemi
- **Papa Parse** - zpracování CSV souborů
- **Flatpickr** - výběr dat s českou lokalizací
- **Font Awesome** - ikony
- **Inter Font** - moderní typografie

## 📁 Struktura CSV

Aplikace očekává CSV soubor s následujícími sloupci:

| Sloupec | Popis | Příklad |
|---------|-------|---------|
| `Datum` | Datum transakce | `15.01.2024` |
| `Časová zóna` | Časová zóna | `CET` |
| `Typ` | Typ transakce | `Investice`, `Výběr`, `Dividenda`, `Poplatek` |
| `Detail` | Popis transakce | `Investice do energetického projektu` |
| `Částka [CZK]` | Částka v CZK | `50000`, `-15000` |
| `Název projektu` | Název projektu | `Solární park Brno` |
| `Odkaz na projekt` | URL projektu | `https://example.com/projekt` |
| `Typ projektu` | Kategorie projektu | `Obnovitelná energie`, `Nemovitosti` |

## 🛠️ Instalace a spuštění

### Požadavky
- Moderní webový prohlížeč (Chrome, Firefox, Safari, Edge)
- Lokální webový server (pro development)

### Rychlé spuštění
1. **Stáhněte** nebo naklonujte repository
2. **Otevřete** `index.html` v prohlížeči
3. **Nahrajte** CSV soubor pomocí drag & drop nebo tlačítka

### Development server
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# PHP
php -S localhost:8000
```

Poté navštivte `http://localhost:8000`

## 📊 Ukázka dat

V repository je připojen soubor `sample_data.csv` s ukázkovými daty pro testování aplikace. Obsahuje 48 transakcí různých typů a projektů za rok 2024.

## 🎨 Design

### Barevná paleta
- **Primární**: `#2563eb` (modrá)
- **Sekundární**: `#10b981` (zelená)
- **Úspěch**: `#10b981`
- **Chyba**: `#ef4444`
- **Varování**: `#f59e0b`

### Responzivní breakpointy
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## ✨ Animace

- **Fade-in** efekty při načítání
- **Hover** animace na kartách a tlačítkách
- **Slide-in** animace pro statistické karty
- **Bounce** animace pro úspěšné akce
- **Smooth transitions** pro všechny interakce

## 🌐 Lokalizace

Aplikace je plně lokalizovaná do češtiny:
- **Rozhraní** - všechny texty v češtině
- **Formátování dat** - český formát (dd.mm.yyyy)
- **Formátování čísel** - české formátování měny (Kč)
- **Výběr dat** - český kalendář

## 📱 Přístupnost

- **Sémantický HTML** - správné značkování
- **ARIA labels** - popisky pro screen readery
- **Klávesová navigace** - plná podpora klávesnice
- **Kontrastní barvy** - splňuje WCAG standardy
- **Responzivní text** - škáluje podle zařízení

## 🔧 Konfigurace

### Stránkování
```javascript
state.pagination.itemsPerPage = 50; // Počet záznamů na stránku
```

### Formátování měny
```javascript
locale.formatNumber = (num) => {
    return new Intl.NumberFormat('cs-CZ', {
        style: 'currency',
        currency: 'CZK'
    }).format(num);
};
```

## 🐛 Řešení problémů

### CSV se nenačítá
- Zkontrolujte, zda soubor má příponu `.csv`
- Ověřte, že obsahuje všechny povinné sloupce
- Zkontrolujte kódování souboru (UTF-8)

### Grafy se nezobrazují
- Zkontrolujte internetové připojení (CDN knihovny)
- Ověřte, že data obsahují validní částky
- Otevřete konzoli prohlížeče pro chybové zprávy

### Filtry nefungují
- Zkontrolujte, že data obsahují hodnoty ve filtrovaných sloupcích
- Zkuste vymazat filtry tlačítkem "Vymazat filtry"

## 📈 Výkon

### Optimalizace
- **Lazy loading** pro velké datasety
- **Debounced** vyhledávání (300ms)
- **Virtualizace** pro stránkování
- **Caching** pro vypočítané statistiky

### Limity
- **Doporučeno**: do 10,000 záznamů
- **Maximum**: 50,000 záznamů (závisí na výkonu zařízení)

## 🔄 Aktualizace

### Verze 1.0.0
- Základní funkcionalita
- Czech lokalizace
- Responzivní design
- Export do CSV

## 📞 Podpora

Pro otázky a problémy:
1. Zkontrolujte dokumentaci
2. Otevřete issue na GitHubu
3. Zkontrolujte konzoli prohlížeče pro chyby

## 📄 Licence

MIT License - viz LICENSE soubor pro detaily.

---

**Vytvořeno s ❤️ pro českou investiční komunitu** 