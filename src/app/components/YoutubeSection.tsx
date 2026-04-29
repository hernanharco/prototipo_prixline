import React from 'react';
import { motion } from 'motion/react';
import { Youtube, Play, ExternalLink } from 'lucide-react';

const videos = [
  {
    id: 1,
    title: "Cómo migrar a España de forma responsable: Guía 2026",
    thumbnail: "https://images.unsplash.com/photo-1570136608985-36fdcec5b7da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGFpbiUyMGZsYWclMjBhcmNoaXRlY3R1cmUlMjBtYWRyaWQlMjBiYXJjZWxvbmF8ZW58MXx8fHwxNzcwNTU0Nzk1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    views: "15k vistas",
    duration: "12:45"
  },
  {
    id: 2,
    title: "Visado de Estudiante: Requisitos y Trámites",
    thumbnail: "https://images.unsplash.com/photo-1721138942121-a26751b520b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwdmlzYSUyMHBhc3Nwb3J0JTIwdHJhdmVsfGVufDF8fHx8MTc3MDU1NDc5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    views: "8.2k vistas",
    duration: "18:20"
  },
  {
    id: 3,
    title: "Errores comunes al buscar piso en Madrid",
    thumbnail: "https://images.unsplash.com/photo-1673767297172-220430e2d382?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3V0dWJlJTIwY29udGVudCUyMGNyZWF0b3IlMjBzdHVkaW98ZW58MXx8fHwxNzcwNTU0Nzk1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    views: "5k vistas",
    duration: "09:15"
  }
];

export function YoutubeSection() {
  return (
    <section id="youtube" className="py-24 bg-gray-900 text-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-red-900/20 to-transparent pointer-events-none"></div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
               <div className="p-2 bg-red-600 rounded-lg">
                 <Youtube className="text-white w-6 h-6" />
               </div>
               <span className="text-red-400 font-bold tracking-widest uppercase text-sm">Prixline en YouTube</span>
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">Migra con Responsabilidad</h2>
            <p className="text-gray-400 text-lg">
              Tutoriales paso a paso, consejos legales y experiencias reales para que tu llegada a España sea segura y exitosa.
            </p>
          </div>
          
          <a 
            href="https://www.youtube.com/@prixline" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white text-gray-900 hover:bg-gray-100 px-6 py-3 rounded-xl font-bold transition-colors"
          >
            <span>Ver Canal Completo</span>
            <ExternalLink size={18} />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="group cursor-pointer"
            >
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4 shadow-lg bg-black">
                <img 
                    src={video.thumbnail} 
                    alt={video.title} 
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity duration-300 group-hover:scale-105 transform"
                />
                <div className="absolute bottom-3 right-3 bg-black/80 px-2 py-1 rounded text-xs font-medium">
                    {video.duration}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center pl-1 shadow-xl scale-90 group-hover:scale-100 transition-transform">
                        <Play fill="white" className="text-white w-6 h-6" />
                    </div>
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 leading-snug group-hover:text-red-400 transition-colors">
                {video.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Prixline</span>
                <span>•</span>
                <span>{video.views}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
