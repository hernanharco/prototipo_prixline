import { motion } from 'motion/react';
import { Search, MapPin } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-48 bg-white overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto text-center"
        >
            <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-8">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                Especialistas en Migración Responsable
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold text-primary mb-6 tracking-tight leading-[1.1]">
                Encuentra el curso para <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-orange-600">tu nueva vida en España</span>
            </h1>

            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                Buscador especializado de formación profesional y estudios superiores. Te ayudamos a elegir el camino educativo correcto para migrar con éxito.
            </p>

            {/* Search Bar */}
            <div className="max-w-2xl mx-auto relative bg-white rounded-2xl shadow-2xl shadow-gray-200/50 p-2 flex flex-col sm:flex-row gap-2 border border-gray-100">
                <div className="flex-1 relative flex items-center px-4">
                    <Search className="text-gray-400 w-5 h-5 absolute left-4" />
                    <input 
                        type="text" 
                        placeholder="¿Qué quieres estudiar? Ej: Informática, Marketing..." 
                        className="w-full py-4 pl-10 text-gray-700 bg-transparent outline-none placeholder:text-gray-400"
                    />
                </div>
                <div className="w-px h-8 bg-gray-200 hidden sm:block self-center"></div>
                <div className="relative flex items-center px-4 sm:w-1/3">
                    <MapPin className="text-gray-400 w-5 h-5 absolute left-4" />
                    <select className="w-full py-4 pl-10 text-gray-700 bg-transparent outline-none appearance-none cursor-pointer">
                        <option>Madrid</option>
                        <option>Barcelona</option>
                        <option>Valencia</option>
                        <option>Online</option>
                    </select>
                </div>
                <button className="bg-accent hover:bg-accent-hover text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-accent/20">
                    Buscar
                </button>
            </div>
            
            <p className="mt-4 text-sm text-gray-500">
                Tendencias: <a href="#" className="hover:text-accent underline decoration-dotted">Desarrollo Web</a>, <a href="#" className="hover:text-accent underline decoration-dotted">Enfermería</a>, <a href="#" className="hover:text-accent underline decoration-dotted">Turismo</a>
            </p>
        </motion.div>

      </div>

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-50 opacity-40 blur-[100px] rounded-full mix-blend-multiply"></div>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-yellow-50 opacity-40 blur-[100px] rounded-full mix-blend-multiply"></div>
      </div>
    </section>
  );
}
