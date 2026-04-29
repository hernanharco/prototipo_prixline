import React from 'react';
import { Instagram, Twitter, Facebook, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-1">
             <a href="#" className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl">P</div>
                <span className="text-xl font-bold text-primary tracking-tight">Prixline</span>
            </a>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Plataforma líder en formación profesional y e-learning. Conectamos talento con oportunidades reales.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-accent transition-colors"><Instagram size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-accent transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-accent transition-colors"><Facebook size={20} /></a>
              <a href="#" className="text-gray-400 hover:text-accent transition-colors"><Linkedin size={20} /></a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-6">Cursos</h4>
            <ul className="space-y-3 text-sm text-gray-600">
              <li><a href="#" className="hover:text-accent transition-colors">Desarrollo Web</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Data Science</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Marketing Digital</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">UX/UI Design</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-6">Compañía</h4>
            <ul className="space-y-3 text-sm text-gray-600">
              <li><a href="#" className="hover:text-accent transition-colors">Sobre Nosotros</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Carreras</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Contacto</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-primary mb-6">Legal</h4>
            <ul className="space-y-3 text-sm text-gray-600">
              <li><a href="#" className="hover:text-accent transition-colors">Términos y Condiciones</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Privacidad</a></li>
              <li><a href="#" className="hover:text-accent transition-colors">Cookies</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8 text-center text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} Prixline. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
