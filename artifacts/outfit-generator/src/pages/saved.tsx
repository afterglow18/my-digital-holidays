import React from "react";
import { useListOutfits, useDeleteOutfit, getListOutfitsQueryKey } from "@workspace/api-client-react";
import { Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { getImageUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export default function SavedPage() {
  const { data: outfits, isLoading } = useListOutfits();
  const deleteOutfit = useDeleteOutfit();
  const queryClient = useQueryClient();

  const handleDelete = (id: number) => {
    deleteOutfit.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
      }
    });
  };

  return (
    <div className="min-h-full flex flex-col pt-8 px-4 pb-8 bg-secondary/10 relative">
      <header className="mb-6">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-2">Lookbook</h1>
        <p className="font-medium text-muted-foreground">Hall of fame.</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-40 bg-muted animate-pulse border-2 border-black rounded-xl" />
          ))}
        </div>
      ) : outfits && outfits.length > 0 ? (
        <div className="flex flex-col gap-6">
          {outfits.map((outfit) => (
            <motion.div 
              key={outfit.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b-2 border-black flex justify-between items-center bg-accent">
                <h3 className="font-display font-bold text-xl uppercase">{outfit.name}</h3>
                <button 
                  onClick={() => handleDelete(outfit.id)}
                  className="w-8 h-8 flex items-center justify-center bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none hover:bg-destructive hover:text-white"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 flex overflow-x-auto gap-2 no-scrollbar">
                {outfit.items?.map(item => (
                  <div key={item.id} className="w-24 h-32 flex-none bg-muted border-2 border-black relative overflow-hidden">
                    {item.imageObjectPath ? (
                      <img src={getImageUrl(item.imageObjectPath)!} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 text-center bg-secondary">
                        <span className="text-[10px] font-bold uppercase">{item.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl mt-8">
          <h3 className="font-display font-bold text-xl mb-2">No looks saved.</h3>
          <p className="text-sm font-medium text-muted-foreground">Go generate some iconic fits first!</p>
        </div>
      )}
    </div>
  );
}
