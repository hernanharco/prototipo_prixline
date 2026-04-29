import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Cursos', href: '#courses' },
    { name: 'En Vivo', href: '#live' },
    { name: 'Prácticas', href: '#internships' },
    { name: 'Nosotros', href: '#about' },
  ];

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl">P</div>
            <span className="text-xl font-bold text-primary tracking-tight">Prixline</span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
            >
              {link.name}
            </a>
          ))}
        </nav>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-4">
            <button className="text-sm font-medium text-gray-600 hover:text-primary px-4 py-2 hover:bg-gray-50 rounded-lg transition-colors">
                Log In
            </button>
            <button className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-accent/20">
                Regístrate Gratis
            </button>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden text-gray-700"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100">
          <nav className="flex flex-col p-6 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-base font-medium text-gray-700 hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                <button className="w-full text-center py-2 text-gray-600 font-medium hover:text-primary hover:bg-gray-50 rounded-lg transition-colors">Log In</button>
                <button className="w-full bg-accent hover:bg-accent-hover text-white py-3 rounded-lg font-medium shadow-lg shadow-accent/20 transition-colors">Regístrate Gratis</button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
