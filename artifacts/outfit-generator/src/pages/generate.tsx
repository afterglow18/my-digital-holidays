import React, { useState } from "react";
import { useGenerateOutfit, useSaveOutfit, getListOutfitsQueryKey } from "@workspace/api-client-react";
import { Sparkles, Save, RotateCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getImageUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export default function GeneratePage() {
  const [excludeCategories, setExcludeCategories] = useState<string[]>([]);
  const generateOutfit = useGenerateOutfit();
  const saveOutfit = useSaveOutfit();
  const queryClient = useQueryClient();
  const [saveName, setSaveName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = () => {
    generateOutfit.mutate({ data: { excludeCategories } });
    setIsSaving(false);
    setSaveName("");
  };

  const handleSave = () => {
    if (!generateOutfit.data?.items.length || !saveName) return;
    
    saveOutfit.mutate({
      data: {
        name: saveName,
        itemIds: generateOutfit.data.items.map(i => i.id)
      }
    }, {
      onSuccess: () => {
        setIsSaving(false);
        queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
        // Optional: show a toast or something, but the UI updates anyway
      }
    });
  };

  const currentOutfit = generateOutfit.data;

  return (
    <div className="min-h-full flex flex-col pt-8 px-4 pb-8 bg-accent/20 relative">
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-2 text-accent-foreground">Matchmaker</h1>
        <p className="font-medium">Let's find something to wear.</p>
      </header>

      {!currentOutfit && !generateOutfit.isPending ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-50 animate-pulse" />
            <button
              onClick={handleGenerate}
              className="relative w-48 h-48 bg-primary rounded-full border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-2 active:translate-x-2"
            >
              <Sparkles className="w-12 h-12 text-black" />
              <span className="font-display font-bold text-2xl uppercase tracking-widest text-black">Spin It!</span>
            </button>
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          {generateOutfit.isPending ? (
            <div className="flex-1 flex items-center justify-center">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Sparkles className="w-16 h-16 text-primary" />
              </motion.div>
            </div>
          ) : currentOutfit ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 grid grid-cols-2 gap-3 auto-rows-max justify-center content-center mb-8">
                <AnimatePresence>
                  {currentOutfit.items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.8, y: 50 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: index * 0.15, type: "spring", stiffness: 200, damping: 15 }}
                      className={`card-brutalist overflow-hidden aspect-[3/4] relative ${
                        index === 0 && currentOutfit.items.length % 2 !== 0 ? 'col-span-2 aspect-[4/3]' : ''
                      }`}
                    >
                      {item.imageObjectPath ? (
                        <img 
                          src={getImageUrl(item.imageObjectPath)!} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-secondary flex items-center justify-center p-4 text-center">
                          <span className="font-bold uppercase text-xl">{item.name}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-black p-2 flex justify-between items-center">
                        <span className="font-bold text-xs truncate uppercase">{item.category}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-4 mt-auto">
                {isSaving ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-4 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl flex gap-2"
                  >
                    <input 
                      type="text" 
                      placeholder="Name this look..."
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      className="flex-1 bg-muted px-3 py-2 border-2 border-black outline-none focus:bg-white font-bold"
                    />
                    <button 
                      onClick={handleSave}
                      disabled={!saveName || saveOutfit.isPending}
                      className="bg-primary text-black px-4 py-2 border-2 border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setIsSaving(false)}
                      className="bg-white text-black px-3 py-2 border-2 border-black font-bold uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex gap-4">
                    <button 
                      onClick={handleGenerate}
                      className="flex-1 btn-brutalist bg-white py-4 rounded-xl flex items-center justify-center gap-2"
                    >
                      <RotateCw className="w-5 h-5" />
                      Re-spin
                    </button>
                    <button 
                      onClick={() => setIsSaving(true)}
                      className="flex-1 btn-brutalist py-4 rounded-xl flex items-center justify-center gap-2"
                    >
                      <Save className="w-5 h-5" />
                      Keep It
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
