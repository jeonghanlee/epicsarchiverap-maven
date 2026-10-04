package org.epics.archiverappliance.utils.nio;

import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.channels.SeekableByteChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/**
 * Compressed files typically do not let us seek arbitrarily within the stream.
 * This is a inefficient workaround for this. 
 * This can be improved with ZRan like functionality later if needed.
 * This implements a read only seekable byte channel over a one way input stream.
 * @author mshankar
 *
 */
public class WrappedSeekableByteChannel implements SeekableByteChannel {
	private Path srcPath = null;
	private InputStream backingIs = null;
	long position = 0;
	
	public WrappedSeekableByteChannel(Path path) throws IOException {
		this.srcPath = path;
		backingIs = Files.newInputStream(srcPath, StandardOpenOption.READ);
	}

	@Override
	public void close() throws IOException {
		if( backingIs != null) backingIs.close();
		backingIs = null;
	}

	@Override
	public boolean isOpen() {
		return backingIs != null;
	}

	@Override
	public long position() throws IOException {
		return position;
	}

	@Override
	public SeekableByteChannel position(long newPosition) throws IOException {
		if(newPosition == position) {
			// No need to do anything...
		} else if(newPosition > position) {
			skipFully(newPosition - position);
			this.position = newPosition;
		} else { 
			// Here's the inefficient part, we close the stream and open another
			backingIs.close();
			backingIs = null;
			backingIs = Files.newInputStream(srcPath, StandardOpenOption.READ);
			skipFully(newPosition);
			this.position = newPosition;
		}
		return this;
	}

	/**
	 * Advances the backing stream by count bytes, or to its end if that comes first.
	 * InputStream.skip may skip fewer bytes than asked, so this repeats it and falls back to a single read when skip makes no progress.
	 */
	private void skipFully(long count) throws IOException {
		long remaining = count;
		while(remaining > 0) {
			long skipped = backingIs.skip(remaining);
			if(skipped <= 0) {
				if(backingIs.read() == -1) return;
				skipped = 1;
			}
			remaining -= skipped;
		}
	}

	/**
	 * Fills the buffer from the current position until it is full or the stream ends, and returns -1 only at the end of the stream.
	 * A decompressing stream returns fewer bytes per read than asked; callers such as LineByteStream treat one read as the whole batch, so a short read would hide the tail of the entry.
	 */
	@Override
	public int read(ByteBuffer byteBuf) throws IOException {
		int bufPotential = byteBuf.remaining();
		if(bufPotential == 0) return 0;
		byte[] buf = new byte[bufPotential];
		int bytesRead = backingIs.readNBytes(buf, 0, bufPotential);
		if(bytesRead > 0) {
			byteBuf.put(buf, 0, bytesRead);
			position = position + bytesRead;
			return bytesRead;
		}
		return -1;
	}

	@Override
	public long size() throws IOException {
		return Files.size(srcPath);
	}

	@Override
	public SeekableByteChannel truncate(long arg0) throws IOException {
		throw new UnsupportedOperationException();
	}

	@Override
	public int write(ByteBuffer arg0) throws IOException {
		throw new UnsupportedOperationException();
	}

}
