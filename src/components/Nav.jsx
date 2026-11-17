import { useEffect, useRef, useState } from 'react'
import { Logo, Wordmark } from './Logo'
import Icon from './Icon'
import './Nav.css'

/**
 * The same menu as representdc-main's Nav (src/components/Nav.jsx there), so the three
 * RepresentDC sites read as one site (decided 2026-11-16). Keep the list, labels and
 * order identical to it. This repo has no router, so every destination is an absolute
 * URL, and the site you are on is marked as the current page instead of linked.
 *
 * Per-site differences are the three constants below and nothing else.
 */
const MAIN = 'https://www.representdc.org'
const CURRENT = 'Bill tracker'
// The main site's red button sends people here; on this site it offers the next step.
const CTA = { label: 'Stay in the loop', href: `${MAIN}/follow` }

const NAV_ITEMS = [
  { label: 'Home', href: MAIN },
  { label: 'Congress & D.C.', href: `${MAIN}/how-congress-controls-dc` },
  { label: 'The case', href: `${MAIN}/the-case` },
  { label: 'Myths', href: `${MAIN}/myths` },
  { label: 'News & analysis', href: `${MAIN}/news` },
  { label: 'Statehood bill', href: `${MAIN}/statehood-bill` },
  { label: 'Bill tracker', href: 'https://billtracker.representdc.org' },
  {
    label: 'Candidates',
    href: 'https://candidates.representdc.org',
    title: 'For D.C. voters: 2026 primary candidate positions on statehood',
  },
  { label: 'Follow', href: `${MAIN}/follow` },
]

function NavItem({ item, className, onClick }) {
  if (item.label === CURRENT) {
    return (
      <span className={`${className} ${className}-current`} aria-current="page">
        {item.label}
      </span>
    )
  }
  return (
    <a className={className} href={item.href} title={item.title} onClick={onClick}>
      {item.label}
    </a>
  )
}

function Nav() {
  const [open, setOpen] = useState(false)
  const navRef = useRef(null)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    panelRef.current?.querySelector('a')?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        // Only pull focus back if it was in the nav; don't yank it from elsewhere.
        const active = document.activeElement
        if (!active || active === document.body || navRef.current?.contains(active)) {
          buttonRef.current?.focus()
        }
      }
    }
    function onPointerDown(event) {
      if (!navRef.current?.contains(event.target)) setOpen(false)
    }
    // The panel only exists below the breakpoint; widening the window past it closes it.
    const wide = window.matchMedia('(min-width: 1160px)')
    function onWide(event) {
      if (!event.matches) return
      const active = document.activeElement
      if (panelRef.current?.contains(active) || active === buttonRef.current) {
        navRef.current?.querySelector('.nav-brand')?.focus()
      }
      setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    wide.addEventListener('change', onWide)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      wide.removeEventListener('change', onWide)
    }
  }, [open])

  const close = () => setOpen(false)

  // Tabbing past the last menu item would otherwise leave focus on page content hidden
  // under the open panel.
  function onBlur(event) {
    if (open && event.relatedTarget && !navRef.current?.contains(event.relatedTarget)) close()
  }

  return (
    <nav className="nav" ref={navRef} onBlur={onBlur}>
      <div className="nav-inner">
        <a className="nav-brand" href={MAIN} aria-label="RepresentDC main site">
          <Logo size={26} />
          <Wordmark size={15} />
        </a>
        <div className="nav-links">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.label} item={item} className="nav-link" />
          ))}
          <a className="nav-cta" href={CTA.href}>{CTA.label}</a>
          <button
            ref={buttonRef}
            type="button"
            className="nav-menu-button"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? 'x' : 'menu'} size={20} />
            <span className="nav-menu-button-label">Menu</span>
          </button>
        </div>
      </div>
      <div id="nav-menu" className="nav-menu" ref={panelRef} hidden={!open}>
        <ul className="nav-menu-list">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <NavItem item={item} className="nav-menu-link" onClick={close} />
            </li>
          ))}
          <li className="nav-menu-cta-item">
            <a className="nav-cta" href={CTA.href} onClick={close}>{CTA.label}</a>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Nav
