import React from 'react';
import { motion } from 'motion/react';
import { Clock, Star } from 'lucide-react';

const courses = [
  {
    id: 1,
    title: "Full Stack Web Development",
    category: "Tecnología",
    price: "$299",
    rating: 4.8,
    students: 120,
    duration: "12 Semanas",
    image: "https://images.unsplash.com/photo-1557324232-b8917d3c3dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9ncmFtbWluZyUyMGNvZGUlMjBzY3JlZW58ZW58MXx8fHwxNzcwNTEzMjA0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: 2,
    title: "Data Science & Analytics",
    category: "Data",
    price: "$349",
    rating: 4.9,
    students: 85,
    duration: "10 Semanas",
    image: "https://images.unsplash.com/photo-1759661966728-4a02e3c6ed91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwbWFya2V0aW5nJTIwZGF0YSUyMGFuYWx5c2lzfGVufDF8fHx8MTc3MDU1MTkwNnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  },
  {
    id: 3,
    title: "Business Management",
    category: "Negocios",
    price: "$249",
    rating: 4.7,
    students: 210,
    duration: "8 Semanas",
    image: "https://images.unsplash.com/photo-1686223679578-ef90e37bf58d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG1hbmFnZW1lbnQlMjBtZWV0aW5nfGVufDF8fHx8MTc3MDU1MzMyN3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
  }
];

export function Courses() {
  return (
    <section id="courses" className="py-24 bg-bg-soft">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12">
            <div className="max-w-xl">
                <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">Explora nuestros cursos</h2>
                <p className="text-gray-600">Programas diseñados para la realidad del mercado laboral actual.</p>
            </div>
            <button className="hidden md:block text-accent font-semibold hover:text-accent-hover transition-colors">
                Ver todo el catálogo →
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col"
            >
              <div className="h-48 overflow-hidden relative">
                <img 
                    src={course.image} 
                    alt={course.title} 
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary uppercase tracking-wide">
                    {course.category}
                </div>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3 font-medium">
                    <span className="flex items-center gap-1"><Clock size={14} /> {course.duration}</span>
                    <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400" /> {course.rating}</span>
                </div>
                
                <h3 className="text-lg font-bold text-primary mb-2 line-clamp-2">{course.title}</h3>
                
                <div className="mt-auto pt-6 flex items-center justify-between border-t border-gray-50">
                    <span className="text-2xl font-bold text-primary">{course.price}</span>
                    <button className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
                        Más Información
                    </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
            <button className="text-accent font-semibold hover:text-accent-hover transition-colors">
                Ver todo el catálogo →
            </button>
        </div>
      </div>
    </section>
  );
}
