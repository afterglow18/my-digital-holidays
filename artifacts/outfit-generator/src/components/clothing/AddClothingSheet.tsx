import React from "react";
import { Sheet } from "@/components/ui/sheet";
import { ClothingForm, ClothingFormData } from "./ClothingForm";
import { useCreateClothingItem, getListClothingQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface AddClothingSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddClothingSheet({ open, onOpenChange }: AddClothingSheetProps) {
  const createItem = useCreateClothingItem();
  const queryClient = useQueryClient();

  const handleSubmit = (data: ClothingFormData) => {
    createItem.mutate(
      { data: { ...data, imageObjectPath: data.imageObjectPath || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          onOpenChange(false);
        }
      }
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="New Item">
      <ClothingForm 
        onSubmit={handleSubmit} 
        isSubmitting={createItem.isPending}
        submitLabel="Add to Closet"
      />
    </Sheet>
  );
}
