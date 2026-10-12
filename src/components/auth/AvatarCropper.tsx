import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ImageCropper from '@/components/shared/ImageCropper';
import { EchoHeader } from '@/components/shared/EchoWord';

// ============================================================
// Encuadre de la foto de perfil: el mismo encuadre que el resto de imágenes
// (la imagen completa, con un recuadro —aquí redondo— y lo de fuera
// oscurecido; 1.6.6). Sale a 256 × 256.
// ============================================================

interface AvatarCropperProps {
  imageSrc: string | null;
  onClose: () => void;
  onSave: (croppedImage: string) => void;
}

const AvatarCropper = ({ imageSrc, onClose, onSave }: AvatarCropperProps) => {
  if (!imageSrc) return null;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <EchoHeader word="Encuadrar">
          <DialogHeader>
            <DialogTitle className="text-center">Encuadrar la foto</DialogTitle>
            <DialogDescription className="sr-only">Elige qué parte de la imagen será tu foto de perfil.</DialogDescription>
          </DialogHeader>
        </EchoHeader>
        <div className="pt-2">
          <ImageCropper
            src={imageSrc}
            aspect={1}
            round
            outputWidth={256}
            cancelLabel="Cancelar"
            onCancel={onClose}
            onConfirm={(dataUrl) => onSave(dataUrl)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropper;
