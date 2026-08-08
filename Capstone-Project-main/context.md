# context.md

## Project Context

This project follows Northwestern University's Office of Global Marketing and Communications (OGMC) web standards.

The website should reflect Northwestern's official digital design principles and prioritize accessibility, performance, maintainability, and usability.

---

# Primary Goals

Build pages that are:

- Accessible (WCAG 2.2 compliant)
- Mobile-first
- Fast loading
- SEO optimized
- Easy to maintain
- Compatible with CMS-generated content
- Consistent with Northwestern branding

---

# Design Principles

## Accessibility

Accessibility is required, not optional.

Always:

- use semantic HTML
- include proper heading hierarchy
- provide alt text for images
- associate labels with form fields
- maintain keyboard navigation
- include visible focus indicators
- use sufficient color contrast
- avoid using color as the only indicator
- support screen readers
- use ARIA only when native HTML is insufficient

---

## Responsive Design

Design mobile-first.

Support:

- phones
- tablets
- laptops
- desktops

Layouts should gracefully scale without horizontal scrolling.

---

## Performance

Prioritize:

- optimized images
- lazy loading
- code splitting
- compressed assets
- minimal JavaScript
- efficient CSS

Avoid unnecessary libraries.

---

## SEO

Every page should include:

- unique title
- meta description
- canonical URL
- descriptive headings
- structured content
- meaningful link text
- optimized image alt text

Avoid duplicate content.

---

## Content Guidelines

Content should be:

- concise
- scannable
- user-focused
- accurate
- easy to update

Prefer:

- short paragraphs
- bullet lists
- descriptive headings

Avoid:

- marketing fluff
- unnecessary jargon
- duplicated information

---

## Navigation

Navigation should be:

- predictable
- consistent
- keyboard accessible

Users should always know:

- where they are
- where they can go
- how to return

---

## Forms

Forms should:

- validate both client and server side
- provide clear error messages
- identify required fields
- preserve entered values after validation
- be fully keyboard accessible

---

## Images

Images should:

- have descriptive alt text
- be optimized
- use responsive sizing
- avoid embedding text inside images

Decorative images should use empty alt attributes.

---

## Components

Preferred reusable components:

- Header
- Footer
- Navigation
- Hero
- Cards
- Accordions
- Alerts
- Tables
- Breadcrumbs
- Buttons
- Forms
- Search
- Pagination

Components should remain modular and reusable.

---

## Typography

Prioritize readability.

Maintain:

- consistent spacing
- logical heading hierarchy
- sufficient line height
- adequate whitespace

Never skip heading levels.

---

## Color

Colors must satisfy accessibility contrast requirements.

Avoid relying on color alone to communicate meaning.

---

## JavaScript

JavaScript should progressively enhance the experience.

The website should remain usable if JavaScript fails.

Avoid unnecessary animations.

Respect prefers-reduced-motion.

---

## Analytics

Pages should be compatible with Google Analytics 4.

Avoid hardcoding analytics events into UI components.

Events should be configurable.

---

## CMS Compatibility

Assume content may eventually be managed through a CMS.

Components should:

- accept dynamic content
- avoid hardcoded text
- separate content from presentation

---

## Code Style

Prefer:

- reusable components
- readable code
- descriptive variable names
- modular architecture
- maintainable CSS
- minimal dependencies

Avoid duplication.

---

## Documentation

Every reusable component should include:

- purpose
- props/options
- accessibility notes
- usage example

---

## Quality Checklist

Before completing any page verify:

- semantic HTML
- responsive layout
- keyboard accessibility
- screen reader compatibility
- SEO metadata
- optimized assets
- no console errors
- no accessibility violations
- consistent styling
- reusable code

---

# Overall Objective

Create modern, maintainable, accessible university web pages that align with Northwestern University's official web standards while delivering an excellent user experience across all devices.