import torch
import sys

def main():
    # Usage: python convert_pure.py model.pth scrfd_500m_kps.onnx
    checkpoint_path = sys.argv[1] if len(sys.argv) > 1 else 'model.pth'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'scrfd_500m_kps.onnx'
    
    print(f"Loading checkpoint from {checkpoint_path}...")
    checkpoint = torch.load(checkpoint_path, map_location='cpu')
    
    # Extract state dict if nested
    state_dict = checkpoint.get('state_dict', checkpoint)
    
    # Check if the whole model architecture object was saved natively
    if 'model' in checkpoint:
        model = checkpoint['model']
        model.eval()
        dummy_input = torch.randn(1, 3, 640, 640)
        
        print("Exporting model graph to ONNX...")
        torch.onnx.export(
            model, dummy_input, output_path,
            export_params=True, opset_version=11,
            input_names=['input'], output_names=['output']
        )
        print(f"Successfully converted to {output_path}!")
    else:
        print("Error: This checkpoint only contains weights, not the complete model graph.")
        print("Please install mmdet without mim using: pip install mmdet mmcv mmengine")

if __name__ == '__main__':
    main()
