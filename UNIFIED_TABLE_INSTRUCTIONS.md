# Unified Table System Implementation

## Required HTML Changes

To make both tables use identical styling, update the HTML structure as follows:

### 1. First Table ("Transakce") - Replace existing structure:

**FROM:**
```html
<div class="table-card">
    <div class="table-header">
        <!-- header content -->
    </div>
    <div class="table-container">
        <!-- table content -->
    </div>
    <div class="table-pagination">
        <!-- pagination content -->
    </div>
</div>
```

**TO:**
```html
<div class="unified-table-container">
    <div class="unified-table-header">
        <!-- header content -->
    </div>
    <div class="unified-table-content">
        <!-- table content -->
    </div>
    <div class="unified-table-pagination">
        <!-- pagination content -->
    </div>
</div>
```

### 2. Second Table ("Transakce dle projektu") - Replace existing structure:

**FROM:**
```html
<div class="chart-card chart-main">
    <div class="chart-header">
        <!-- header content -->
    </div>
    <div class="table-container">
        <!-- table content -->
    </div>
    <div class="table-pagination">
        <!-- pagination content -->
    </div>
</div>
```

**TO:**
```html
<div class="unified-table-container">
    <div class="unified-table-header">
        <!-- header content -->
    </div>
    <div class="unified-table-content">
        <!-- table content -->
    </div>
    <div class="unified-table-pagination">
        <!-- pagination content -->
    </div>
</div>
```

## Benefits of Unified System

✅ **Identical styling** - Both tables use the exact same classes
✅ **Consistent spacing** - Headers, content, and pagination align perfectly
✅ **Unified padding** - All rows have identical left/right spacing
✅ **Same container behavior** - No differences between table-card and chart-card
✅ **Consistent pagination** - Same bottom padding and positioning

## CSS Features

- `.unified-table-container`: Complete table wrapper with consistent styling
- `.unified-table-header`: Standardized header with proper padding and borders
- `.unified-table-content`: Table content area with proper overflow handling
- `.unified-table-pagination`: Consistent pagination styling and spacing
- `.data-table`: Universal table styling that works identically in both containers 