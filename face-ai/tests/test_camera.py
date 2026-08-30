import cv2


def main():

    print("=" * 60)
    print("RAW CAMERA TEST")
    print("=" * 60)

    for camera_index in [0, 1, 2]:

        print(
            f"\nTrying camera index {camera_index}..."
        )

        camera = cv2.VideoCapture(
            camera_index,
            cv2.CAP_MSMF,
        )

        if not camera.isOpened():

            print("  Could not open.")

            camera.release()

            continue

        print("  Camera opened.")

        success, frame = camera.read()

        print(
            "  Frame read:",
            success,
        )

        if success and frame is not None:

            print(
                "  Frame size:",
                f"{frame.shape[1]} x "
                f"{frame.shape[0]}",
            )

            cv2.imshow(
                f"Camera {camera_index}",
                frame,
            )

            print(
                "  Press any key to close this camera."
            )

            cv2.waitKey(0)

        camera.release()

        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()