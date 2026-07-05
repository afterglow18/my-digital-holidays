import React, { useState } from "react";
import { useListClothing, getListClothingQueryKey, ClothingItemCategory } from "@workspace/api-client-react";
import { Plus, Filter, Shirt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ClothingCard } from "@/components/clothing/ClothingCard";
import { AddClothingSheet } from "@/components/clothing/AddClothingSheet";
import { EditClothingSheet } from "@/components/clothing/EditClothingSheet";

export default function WardrobePage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  const { data: clothes, isLoading } = useListClothing(
    selectedCategory ? { category: selectedCategory as ClothingItemCategory } : undefined,
    { query: { queryKey: getListClothingQueryKey(selectedCategory ? { category: selectedCategory as ClothingItemCategory } : undefined) } }
  );

  const categories = ["tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"];

  return (
    <div className="min-h-full flex flex-col pt-8 px-4 pb-8 bg-background relative">
      <header className="mb-6">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-2">My Closet</h1>
        <p className="text-muted-foreground font-medium">Like, totally organized.</p>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 mb-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`flex-none px-4 py-2 rounded-full border-2 font-bold uppercase tracking-wider text-xs transition-all ${
            selectedCategory === null 
              ? "bg-black text-white border-black" 
              : "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-none px-4 py-2 rounded-full border-2 font-bold uppercase tracking-wider text-xs transition-all ${
              selectedCategory === cat 
                ? "bg-secondary text-black border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" 
                : "bg-white border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:translate-x-0 active:shadow-none"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="aspect-[3/4] bg-muted animate-pulse border-2 border-black rounded-xl" />
          ))}
        </div>
      ) : clothes && clothes.length > 0 ? (
        <motion.div 
          className="grid grid-cols-2 gap-4"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.05 } }
          }}
        >
          {clothes.map((item) => (
            <ClothingCard 
              key={item.id} 
              item={item} 
              onClick={() => setEditingItemId(item.id)} 
            />
          ))}
        </motion.div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl mt-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center border-2 border-black shadow-sm mb-4">
            <Shirt className="w-8 h-8" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">Ugh, as if!</h3>
          <p className="text-sm font-medium text-muted-foreground mb-6">Your closet is empty. Time to go shopping or add some items.</p>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="btn-brutalist px-6 py-3 rounded-full flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      {clothes && clothes.length > 0 && (
        <button
          onClick={() => setIsAddOpen(true)}
          className="absolute bottom-6 right-4 w-14 h-14 bg-primary text-black border-2 border-black rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:translate-x-1 active:shadow-none z-10"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {/* Modals/Sheets */}
      <AddClothingSheet open={isAddOpen} onOpenChange={setIsAddOpen} />
      <EditClothingSheet 
        itemId={editingItemId} 
        open={editingItemId !== null} 
        onOpenChange={(open) => !open && setEditingItemId(null)} 
      />
    </div>
  );
}
